"""复习智能体 Web 服务 — FastAPI 入口"""

import json
import os
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel

from providers.factory import (
    create_provider, load_config, save_config,
    get_available_providers, get_safe_config,
)
from storage.file_store import FileStore

# ========== 初始化 ==========

BASE_DIR = Path(__file__).parent.parent  # ~/review-assistant/
STATIC_DIR = Path(__file__).parent / "static"

app = FastAPI(title="全科复习智能体", version="2.0.0")
store = FileStore(str(BASE_DIR))

# ========== 请求/响应模型 ==========

class ConfigUpdate(BaseModel):
    provider: str
    model: str
    api_key: str
    base_url: str = ""
    parameters: dict = {}

class MaterialText(BaseModel):
    subject: str
    content: str

class QuizGenerate(BaseModel):
    subject: str
    mode: str = "concept"  # concept / blank / mixed / weak / quick / code
    count: int = 5

class QuizGrade(BaseModel):
    subject: str
    topic: str
    question: str
    user_answer: str
    correct_answer: str = ""
    explanation: str = ""
    error_type: str = ""

class SummaryRequest(BaseModel):
    subject: str = ""
    mode: str = ""  # chapter / mindmap / compare / cheatsheet / chain
    chapter: str = ""
    concept_a: str = ""
    concept_b: str = ""
    start_concept: str = ""

class ExamDate(BaseModel):
    subject: str
    exam_date: str

class ErrorReview(BaseModel):
    subject: str = ""
    topic: str = ""

class ScheduleGenerate(BaseModel):
    pass


# ========== 配置 API ==========

@app.get("/api/config")
async def api_get_config():
    """获取当前配置（不返回 api_key）"""
    return get_safe_config()

@app.get("/api/config/providers")
async def api_get_providers():
    """获取可用的 provider 列表"""
    return get_available_providers()

@app.put("/api/config")
async def api_update_config(config: ConfigUpdate):
    """更新模型配置"""
    old_config = load_config()
    api_key = config.api_key
    # 前端发来 __KEEP_EXISTING__ 表示保留已有Key（只改其他配置）
    if api_key == "__KEEP_EXISTING__":
        api_key = old_config.get("api_key", "")

    new_config = {
        "provider": config.provider,
        "model": config.model,
        "api_key": api_key,
        "base_url": config.base_url,
        "parameters": config.parameters,
    }
    save_config(new_config)
    return {"ok": True, "message": "配置已保存"}

@app.post("/api/config/test")
async def api_test_config():
    """测试当前模型连接"""
    config = load_config()
    if not config.get("api_key"):
        raise HTTPException(400, "请先配置 API Key")

    try:
        provider = create_provider(config)
        response = await provider.chat([
            {"role": "user", "content": "请用中文回复：连接测试成功。"}
        ], max_tokens=50)
        return {"ok": True, "message": response.strip()}
    except Exception as e:
        raise HTTPException(500, f"连接失败: {str(e)}")


# ========== 资料 API ==========

@app.get("/api/materials")
async def api_list_materials(subject: str = ""):
    """列出资料"""
    subjects = store.list_subjects()
    if subject:
        subjects = [s for s in subjects if s["name"] == subject]
    return {"subjects": subjects}

@app.post("/api/materials/upload")
async def api_upload_material(
    subject: str = Form(...),
    file: UploadFile = File(...)
):
    """上传资料文件"""
    content = await file.read()
    filepath = store.save_material_file(subject, file.filename, content)
    return {
        "ok": True,
        "subject": subject,
        "filename": file.filename,
        "size": len(content),
        "message": f"已添加资料: {file.filename}",
    }

@app.post("/api/materials/text")
async def api_add_text(data: MaterialText):
    """粘贴文本资料"""
    filepath = store.save_material_text(data.subject, data.content)
    return {
        "ok": True,
        "subject": data.subject,
        "filename": filepath.name,
        "message": f"已保存文本资料: {filepath.name}",
    }

@app.post("/api/materials/parse")
async def api_parse_material(data: MaterialText):
    """用 LLM 解析资料，生成知识点摘要"""
    all_text = store.read_all_materials_text(data.subject)
    if not all_text:
        raise HTTPException(404, f"科目 '{data.subject}' 没有资料")

    config = load_config()
    provider = create_provider(config)

    prompt = f"""你是一位资深教师。请分析以下学习资料，提取知识点结构。

资料内容：
{all_text[:8000]}

请生成一份知识点摘要，包含：
1. 科目名称
2. 章节/主题列表
3. 每个章节的核心概念、定义、公式（如适用）
4. 可出题的知识点清单（每个知识点一行，用 - 开头）

用中文输出，格式为 Markdown。"""

    try:
        knowledge = await provider.chat([
            {"role": "system", "content": "你是一位资深教师，擅长分析整理学科知识点。"},
            {"role": "user", "content": prompt}
        ])
        store.save_knowledge(data.subject, knowledge)
        return {"ok": True, "knowledge": knowledge}
    except Exception as e:
        raise HTTPException(500, f"解析失败: {str(e)}")

@app.post("/api/materials/scan")
async def api_scan_materials():
    """扫描知识覆盖度"""
    coverage = store.scan_coverage()
    return {"coverage": coverage}

@app.delete("/api/materials/{subject}/{filename}")
async def api_delete_material(subject: str, filename: str):
    """删除资料"""
    store.delete_material(subject, filename)
    return {"ok": True, "message": f"已删除: {subject}/{filename}"}


# ========== 测验 API ==========

@app.post("/api/quiz/generate")
async def api_generate_quiz(data: QuizGenerate):
    """生成测验题目"""
    all_text = store.read_all_materials_text(data.subject)
    if not all_text:
        raise HTTPException(404, f"科目 '{data.subject}' 没有资料，请先添加资料")

    knowledge = store.read_knowledge(data.subject)
    knowledge_text = knowledge or "暂无知识点摘要"

    # 错题信息
    weak_errors = store.list_errors(subject=data.subject)
    weak_topics = {}
    for e in weak_errors:
        weak_topics[e["topic"]] = weak_topics.get(e["topic"], 0) + 1

    used_questions = store.get_used_questions(data.subject)
    used_text = "\n".join(used_questions[-20:]) if used_questions else "暂无"

    # 根据模式构建 prompt
    mode_prompts = {
        "concept": f"""请出{data.count}道概念简答题。要求：
- 每道题考察一个核心概念的定义、原理或辨析
- 题目应该有思考深度，不是简单背诵
- 每道题格式：【题号】题目内容
- 避免与"已出题目"重复""",

        "blank": f"""请出{data.count}道填空题。要求：
- 挖掉关键术语/公式/数值
- 用 ______ 表示空白
- 每道题2-4个空
- 格式：【题号】题目（含空白）""",

        "mixed": f"""请出一份综合模拟卷，共{data.count}道题。要求：
- 混合概念题、填空题、简答题
- 难度分布合理（基础40%+中等40%+提高20%）
- 模拟真实考试风格
- 格式：【题号】【题型】题目内容""",

        "weak": f"""请针对以下薄弱知识点出题：
薄弱知识点（按错误次数排列）：
{chr(10).join(f'- {t}: {c}次' for t, c in sorted(weak_topics.items(), key=lambda x: -x[1])[:5]) if weak_topics else '暂无错题记录'}

如果暂无错题，则按常规概念题出题。共{data.count}道题。""",

        "quick": f"""请生成{data.count}张闪卡。要求：
- 正面：关键概念/术语
- 反面：简洁的定义/解释（1-2句话）
- 格式：【题号】正面：XXX → 反面：XXX""",
    }

    mode_prompt = mode_prompts.get(data.mode, mode_prompts["concept"])

    prompt = f"""你是出题老师。根据以下资料为科目「{data.subject}」出题。

## 资料内容
{all_text[:6000]}

## 知识点摘要
{knowledge_text[:2000]}

## 已出过的题目（请避免重复）
{used_text[:1500]}

## 出题要求
{mode_prompt}

请直接输出题目，不要加额外说明。"""

    config = load_config()
    provider = create_provider(config)

    try:
        response = await provider.chat([
            {"role": "system", "content": "你是一位经验丰富的出题老师，擅长根据知识点设计高质量的考题。请用中文出题。"},
            {"role": "user", "content": prompt}
        ])
        return {"ok": True, "questions_text": response, "mode": data.mode}
    except Exception as e:
        raise HTTPException(500, f"出题失败: {str(e)}")

@app.post("/api/quiz/generate-stream")
async def api_generate_quiz_stream(data: QuizGenerate):
    """流式生成测验题目"""
    all_text = store.read_all_materials_text(data.subject)
    if not all_text:
        raise HTTPException(404, "没有资料")

    knowledge = store.read_knowledge(data.subject) or ""
    used_questions = store.get_used_questions(data.subject)
    used_text = "\n".join(used_questions[-20:]) if used_questions else "暂无"

    mode_prompts = {
        "concept": f"请出{data.count}道概念简答题，考察核心概念的定义、原理或辨析。",
        "blank": f"请出{data.count}道填空题，挖掉关键术语/公式，用 ______ 表示空白。",
        "mixed": f"请出一份混合模拟卷，共{data.count}题，混合概念题、填空题、简答题。",
        "weak": f"请针对薄弱知识点出{data.count}道题，重点放在之前常错的知识点上。",
        "quick": f"请生成{data.count}张闪卡，正面是概念/术语，反面是简洁定义。",
        "code": f"请出{data.count}道编程题，从资料中的算法/数据结构知识点出题。",
    }

    mode_prompt = mode_prompts.get(data.mode, mode_prompts["concept"])

    prompt = f"""你是出题老师。根据以下资料为科目「{data.subject}」出题。

## 资料内容
{all_text[:6000]}

## 知识点摘要
{knowledge[:2000]}

## 已出过的题目（请避免重复）
{used_text[:1500]}

## 出题要求
{mode_prompt}

请直接输出题目，不要加额外说明。"""

    config = load_config()
    provider = create_provider(config)

    async def generate():
        try:
            async for chunk in provider.chat_stream([
                {"role": "system", "content": "你是一位经验丰富的出题老师。请用中文出题。"},
                {"role": "user", "content": prompt}
            ]):
                yield f"data: {json.dumps({'text': chunk})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")

@app.post("/api/quiz/grade")
async def api_grade_quiz(data: QuizGrade):
    """批改答案"""
    knowledge = store.read_knowledge(data.subject) or ""

    prompt = f"""你是阅卷老师。请批改以下答案。

科目：{data.subject}
知识点：{data.topic}
题目：{data.question}
学生答案：{data.user_answer}
参考答案（可参考）：{data.correct_answer}

## 相关知识点
{knowledge[:2000]}

请按以下格式回复：
【评判】✅正确 / ⚠️部分正确 / ❌错误
【得分】X/满分
【详解】详细解释正确答案，引用知识点
【错误类型】（如果答错）概念不清 / 记混 / 计算失误 / 完全不会"""

    config = load_config()
    provider = create_provider(config)

    try:
        response = await provider.chat([
            {"role": "system", "content": "你是一位认真负责的阅卷老师。请用中文批改。"},
            {"role": "user", "content": prompt}
        ])

        # 解析批改结果
        is_correct = "✅正确" in response
        is_partial = "⚠️部分正确" in response
        error_type = ""
        if not is_correct:
            if "概念不清" in response: error_type = "概念不清"
            elif "记混" in response: error_type = "记混"
            elif "计算失误" in response: error_type = "计算失误"
            elif "完全不会" in response: error_type = "完全不会"
            else: error_type = "概念不清"

        # 如果错误，自动入库
        error_id = None
        if not is_correct:
            error_id, _ = store.add_error(
                subject=data.subject,
                topic=data.topic,
                question=data.question,
                user_answer=data.user_answer,
                correct_answer=data.correct_answer or response,
                explanation=response,
                error_type=error_type,
            )

        return {
            "ok": True,
            "grading": response,
            "is_correct": is_correct,
            "is_partial": is_partial,
            "error_type": error_type if not is_correct else "",
            "error_id": error_id,
        }
    except Exception as e:
        raise HTTPException(500, f"批改失败: {str(e)}")

@app.post("/api/quiz/grade-stream")
async def api_grade_quiz_stream(data: QuizGrade):
    """流式批改答案"""
    knowledge = store.read_knowledge(data.subject) or ""

    prompt = f"""你是阅卷老师。请批改以下答案。

科目：{data.subject} | 知识点：{data.topic}
题目：{data.question}
学生答案：{data.user_answer}
参考答案：{data.correct_answer}

## 相关知识点
{knowledge[:2000]}

请批改并给出：评判（正确/部分正确/错误）、得分、详解、错误类型。"""

    config = load_config()
    provider = create_provider(config)

    full_response = ""

    async def generate():
        nonlocal full_response
        try:
            async for chunk in provider.chat_stream([
                {"role": "system", "content": "你是一位认真负责的阅卷老师。请用中文批改。"},
                {"role": "user", "content": prompt}
            ]):
                full_response += chunk
                yield f"data: {json.dumps({'text': chunk})}\n\n"

            # 判断并记录错题
            is_correct = "正确" in full_response and "错误" not in full_response
            if not is_correct:
                error_type = "概念不清"
                for et in ["概念不清", "记混", "计算失误", "完全不会"]:
                    if et in full_response:
                        error_type = et
                        break
                error_id, _ = store.add_error(
                    subject=data.subject, topic=data.topic,
                    question=data.question, user_answer=data.user_answer,
                    correct_answer=data.correct_answer or full_response,
                    explanation=full_response, error_type=error_type,
                )
                yield f"data: {json.dumps({'error_id': error_id, 'is_correct': False})}\n\n"
            else:
                yield f"data: {json.dumps({'is_correct': True})}\n\n"

            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


# ========== 错题 API ==========

@app.get("/api/errors")
async def api_list_errors(subject: str = "", topic: str = ""):
    """列出错题"""
    errors = store.list_errors(subject=subject or None, topic=topic or None)
    return {"errors": errors}

@app.get("/api/errors/stats")
async def api_error_stats():
    """错题统计"""
    return store.get_error_stats()

@app.get("/api/errors/{error_id}")
async def api_get_error_detail(error_id: str):
    """获取错题详情"""
    detail = store.get_error_detail(error_id)
    if not detail:
        raise HTTPException(404, f"错题 {error_id} 不存在")
    return {"detail": detail}

@app.post("/api/errors/review")
async def api_review_errors(data: ErrorReview):
    """重做错题 — 获取错题重新出题"""
    errors = store.list_errors(subject=data.subject or None, topic=data.topic or None)
    if not errors:
        raise HTTPException(404, "没有找到错题")

    # 获取错题详细信息
    error_details = []
    for e in errors[:5]:  # 最多5题
        detail = store.get_error_detail(e["id"])
        if detail:
            error_details.append(detail)

    config = load_config()
    provider = create_provider(config)

    prompt = f"""请将以下错题改编为新题（不改知识点，但换角度/换数据），让学生重做：

{chr(10).join(error_details[:3])}

请直接输出改编后的题目，每题标注对应原错题ID。"""

    try:
        response = await provider.chat([
            {"role": "system", "content": "你是出题老师，擅长针对错题设计变体题。"},
            {"role": "user", "content": prompt}
        ])
        return {"ok": True, "questions": response, "original_errors": [e["id"] for e in errors[:5]]}
    except Exception as e:
        raise HTTPException(500, f"生成失败: {str(e)}")

@app.put("/api/errors/{error_id}/clear")
async def api_clear_error(error_id: str):
    """清除错题"""
    # 简单实现：在 error-log.md 中标记已清除
    content = store.error_log_path.read_text(encoding="utf-8")
    if error_id in content:
        content = content.replace(
            f"| {error_id} |", f"| ~~{error_id}~~ ✅ |"
        )
        store.error_log_path.write_text(content, encoding="utf-8")
    return {"ok": True, "message": f"错题 {error_id} 已清除"}


# ========== 总结 API ==========

@app.post("/api/summary/chapter")
async def api_summary_chapter(data: SummaryRequest):
    """生成章节总结"""
    all_text = store.read_all_materials_text(data.subject)
    if not all_text:
        raise HTTPException(404, "没有资料")

    errors = store.list_errors(subject=data.subject)

    prompt = f"""请为科目「{data.subject}」的章节「{data.chapter}」生成结构化总结。

## 资料内容
{all_text[:8000]}

## 错题记录
{chr(10).join(f'- {e["topic"]}: {e["summary"]}' for e in errors[:10]) if errors else '暂无'}

请包含：
1. 核心概念（定义+通俗解释）
2. 关键公式/定理
3. 常见考点
4. 易错提醒（结合错题本）

用中文 Markdown 输出。"""

    config = load_config()
    provider = create_provider(config)

    try:
        response = await provider.chat([
            {"role": "system", "content": "你是资深教师，擅长做章节知识总结。"},
            {"role": "user", "content": prompt}
        ])
        filename = f"{data.subject}-{data.chapter}-summary.md"
        store.save_summary("", filename, response)
        return {"ok": True, "content": response, "filename": filename}
    except Exception as e:
        raise HTTPException(500, f"生成失败: {str(e)}")

@app.post("/api/summary/mindmap")
async def api_summary_mindmap(data: SummaryRequest):
    """生成思维导图"""
    all_text = store.read_all_materials_text(data.subject)
    if not all_text:
        raise HTTPException(404, "没有资料")

    prompt = f"""请为科目「{data.subject}」生成 Mermaid mindmap 格式的思维导图。

## 资料内容
{all_text[:8000]}

要求：
- 使用 mindmap 语法
- 层级清晰，覆盖所有章节
- 用中文

直接输出 Mermaid 代码块。"""

    config = load_config()
    provider = create_provider(config)

    try:
        response = await provider.chat([
            {"role": "system", "content": "你擅长用 Mermaid 绘制思维导图。"},
            {"role": "user", "content": prompt}
        ])
        filename = f"{data.subject}-mindmap.md"
        filepath = store.save_summary("mindmaps", filename, response)
        return {"ok": True, "content": response, "filename": filename}
    except Exception as e:
        raise HTTPException(500, f"生成失败: {str(e)}")

@app.post("/api/summary/compare")
async def api_summary_compare(data: SummaryRequest):
    """概念对比"""
    all_text = store.read_all_materials_text(data.subject)

    prompt = f"""请对比以下两个概念：{data.concept_a} vs {data.concept_b}

## 参考资料
{all_text[:6000]}

请生成对比表格，包含：定义、关键区别、适用场景、常见混淆点。
附1-2道辨析题帮助巩固。

用中文 Markdown 输出。"""

    config = load_config()
    provider = create_provider(config)

    try:
        response = await provider.chat([
            {"role": "system", "content": "你是资深教师，擅长概念辨析。"},
            {"role": "user", "content": prompt}
        ])
        return {"ok": True, "content": response}
    except Exception as e:
        raise HTTPException(500, f"生成失败: {str(e)}")

@app.post("/api/summary/cheatsheet")
async def api_summary_cheatsheet(data: SummaryRequest):
    """生成速记单"""
    all_text = store.read_all_materials_text(data.subject)
    if not all_text:
        raise HTTPException(404, "没有资料")

    errors = store.list_errors(subject=data.subject)

    prompt = f"""请为科目「{data.subject}」生成一份考前速记单（A4纸1页的量）。

## 资料内容
{all_text[:8000]}

## 高频错题知识点
{chr(10).join(f'- {e["topic"]}' for e in errors[:10]) if errors else '暂无'}

要求：
- 只保留最高频考点、核心公式、关键区别
- 布局紧凑，适合考前快速浏览
- 用表格、列表等紧凑格式
- 标出高频易错点

用中文 Markdown 输出。"""

    config = load_config()
    provider = create_provider(config)

    try:
        response = await provider.chat([
            {"role": "system", "content": "你是资深教师，擅长制作考前速记单。"},
            {"role": "user", "content": prompt}
        ])
        filename = f"{data.subject}-cheatsheet.md"
        store.save_summary("cheat-sheets", filename, response)
        return {"ok": True, "content": response, "filename": filename}
    except Exception as e:
        raise HTTPException(500, f"生成失败: {str(e)}")

@app.post("/api/summary/chain")
async def api_summary_chain(data: SummaryRequest):
    """生成知识链"""
    all_text = store.read_all_materials_text(data.subject)
    if not all_text:
        raise HTTPException(404, "没有资料")

    prompt = f"""请从概念「{data.start_concept}」出发，沿着逻辑关系串联相关知识。

## 资料内容
{all_text[:6000]}

要求：
- 生成一条"知识链"：A → B → C → D
- 每步解释关联原因
- 帮助建立体系化理解

用中文 Markdown 输出（可用 Mermaid flowchart）。"""

    config = load_config()
    provider = create_provider(config)

    try:
        response = await provider.chat([
            {"role": "system", "content": "你是资深教师，擅长串联知识点建立体系。"},
            {"role": "user", "content": prompt}
        ])
        return {"ok": True, "content": response}
    except Exception as e:
        raise HTTPException(500, f"生成失败: {str(e)}")


# ========== 进度 & 计划 API ==========

@app.get("/api/progress")
async def api_get_progress():
    """获取进度数据"""
    progress = store.get_progress()

    # 补充实时数据
    subjects = store.list_subjects()
    error_stats = store.get_error_stats()

    # 合并数据
    existing_names = {s["name"] for s in progress["subjects"]}
    for s in subjects:
        if s["name"] not in existing_names:
            progress["subjects"].append({
                "name": s["name"],
                "materials": s["file_count"],
                "reviewed": 0,
                "total": s["knowledge_count"],
                "accuracy": "—",
                "mastery": "⬜ 未开始",
                "exam_date": "未设置",
            })

    progress["total_errors"] = error_stats["total"]
    if progress["total_questions"] > 0:
        progress["overall_accuracy"] = f"{round((progress['total_questions'] - error_stats['total']) / max(progress['total_questions'], 1) * 100)}%"

    return progress

@app.put("/api/progress/exam")
async def api_set_exam_date(data: ExamDate):
    """设置考试日期"""
    progress = store.get_progress()
    found = False
    for s in progress.get("subjects", []):
        if s["name"] == data.subject:
            s["exam_date"] = data.exam_date
            found = True
            break
    if not found:
        progress["subjects"].append({
            "name": data.subject,
            "materials": 0,
            "reviewed": 0,
            "total": 0,
            "accuracy": "—",
            "mastery": "⬜ 未开始",
            "exam_date": data.exam_date,
        })
    store.save_progress(progress)
    return {"ok": True, "message": f"{data.subject} 考试日期已设置为 {data.exam_date}"}

@app.post("/api/schedule")
async def api_generate_schedule():
    """生成复习计划"""
    progress = store.get_progress()
    subjects = progress.get("subjects", [])

    subject_list = "\n".join(
        f"- {s['name']}: 已复习{s.get('reviewed', 0)}/{s.get('total', 0)}章节, "
        f"正确率{s.get('accuracy', 'N/A')}, 考试日期{s.get('exam_date', '未设置')}"
        for s in subjects
    ) if subjects else "暂无科目数据"

    prompt = f"""请根据以下复习进度生成每日复习计划：

## 当前进度
{subject_list}

## 计划要求
- 如果有考试日期，按倒计时安排冲刺/系统/长期节奏
- 每天推荐复习的科目和章节
- 结合正确率，薄弱科目多安排时间
- 留出定期回顾和模拟考的时间

请用中文 Markdown 表格输出一周计划。"""

    config = load_config()
    provider = create_provider(config)

    try:
        response = await provider.chat([
            {"role": "system", "content": "你是资深备考规划师，擅长制定高效复习计划。"},
            {"role": "user", "content": prompt}
        ])
        store.save_plan(response)
        return {"ok": True, "content": response}
    except Exception as e:
        raise HTTPException(500, f"生成失败: {str(e)}")


# ========== 静态文件 ==========

@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "2.0.0"}

# 挂载静态文件（必须在最后）
if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
