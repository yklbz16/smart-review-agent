"""文件存储层 — 封装所有文件读写操作"""

import os
import re
import json
from pathlib import Path
from datetime import date
from typing import Optional


class FileStore:
    """复习助手文件存储管理"""

    def __init__(self, base_dir: str = None):
        if base_dir is None:
            base_dir = str(Path(__file__).parent.parent.parent)
        self.base = Path(base_dir)
        self.materials_dir = self.base / "materials"
        self.banks_dir = self.base / "banks"
        self.errors_dir = self.base / "errors"
        self.summaries_dir = self.base / "summaries"
        self.progress_dir = self.base / "progress"
        self.schedule_dir = self.base / "schedule"

        # 确保所有目录存在
        for d in [self.materials_dir, self.banks_dir, self.errors_dir,
                   self.summaries_dir, self.progress_dir, self.schedule_dir]:
            d.mkdir(parents=True, exist_ok=True)

        self.error_log_path = self.errors_dir / "error-log.md"
        self._ensure_error_log()

    # ========== 资料管理 ==========

    def list_subjects(self) -> list[dict]:
        """列出所有科目及其资料"""
        subjects = []
        if not self.materials_dir.exists():
            return subjects

        for subject_dir in sorted(self.materials_dir.iterdir()):
            if subject_dir.is_dir():
                files = []
                knowledge_count = 0
                for f in sorted(subject_dir.iterdir()):
                    if f.suffix in (".md", ".txt", ".pdf"):
                        files.append({
                            "name": f.name,
                            "size": f.stat().st_size,
                            "type": f.suffix,
                        })
                    if f.name.endswith(".knowledge.md"):
                        knowledge_count = self._count_knowledge_items(f)

                subjects.append({
                    "name": subject_dir.name,
                    "files": files,
                    "file_count": len(files),
                    "knowledge_count": knowledge_count,
                })
        return subjects

    def get_subject_dir(self, subject: str) -> Path:
        """获取科目目录，确保存在"""
        d = self.materials_dir / subject
        d.mkdir(parents=True, exist_ok=True)
        return d

    def save_material_file(self, subject: str, filename: str, content: bytes) -> Path:
        """保存上传的资料文件"""
        d = self.get_subject_dir(subject)
        filepath = d / filename
        filepath.write_bytes(content)
        return filepath

    def save_material_text(self, subject: str, text: str) -> Path:
        """保存粘贴的文本资料"""
        d = self.get_subject_dir(subject)
        today = date.today().isoformat()
        filename = f"manual-notes-{today}.md"
        filepath = d / filename
        filepath.write_text(text, encoding="utf-8")
        return filepath

    def read_material(self, subject: str, filename: str) -> str:
        """读取资料文件内容"""
        filepath = self.materials_dir / subject / filename
        if not filepath.exists():
            raise FileNotFoundError(f"文件不存在: {filepath}")
        return filepath.read_text(encoding="utf-8")

    def delete_material(self, subject: str, filename: str) -> None:
        """删除资料文件"""
        filepath = self.materials_dir / subject / filename
        if filepath.exists():
            filepath.unlink()
        # 同时删除对应的 knowledge 文件
        knowledge_path = self.materials_dir / subject / ".knowledge.md"
        if knowledge_path.exists():
            knowledge_path.unlink()

    def save_knowledge(self, subject: str, content: str) -> Path:
        """保存知识点摘要"""
        filepath = self.materials_dir / subject / ".knowledge.md"
        filepath.write_text(content, encoding="utf-8")
        return filepath

    def read_knowledge(self, subject: str) -> Optional[str]:
        """读取知识点摘要"""
        filepath = self.materials_dir / subject / ".knowledge.md"
        if filepath.exists():
            return filepath.read_text(encoding="utf-8")
        return None

    def read_all_materials_text(self, subject: str) -> str:
        """读取某科目的全部资料文本"""
        d = self.materials_dir / subject
        if not d.exists():
            return ""
        texts = []
        for f in sorted(d.iterdir()):
            if f.suffix in (".md", ".txt") and not f.name.startswith("."):
                texts.append(f"## 文件: {f.name}\n\n{f.read_text(encoding='utf-8')}")
        return "\n\n---\n\n".join(texts)

    # ========== 题库管理 ==========

    def get_bank_dir(self, subject: str) -> Path:
        d = self.banks_dir / subject
        d.mkdir(parents=True, exist_ok=True)
        return d

    def save_used_question(self, subject: str, question_id: str, content: str) -> Path:
        """记录已出过的题目"""
        used_dir = self.banks_dir / subject / "used"
        used_dir.mkdir(parents=True, exist_ok=True)
        filepath = used_dir / f"{question_id}.md"
        filepath.write_text(content, encoding="utf-8")
        return filepath

    def get_used_questions(self, subject: str) -> list[str]:
        """获取已出过的题目内容"""
        used_dir = self.banks_dir / subject / "used"
        if not used_dir.exists():
            return []
        questions = []
        for f in sorted(used_dir.iterdir()):
            if f.suffix == ".md":
                questions.append(f.read_text(encoding="utf-8"))
        return questions

    def get_used_count(self, subject: str) -> int:
        """获取已出题数"""
        used_dir = self.banks_dir / subject / "used"
        if not used_dir.exists():
            return 0
        return len([f for f in used_dir.iterdir() if f.suffix == ".md"])

    # ========== 错题管理 ==========

    def _ensure_error_log(self):
        """确保错题日志文件存在"""
        if not self.error_log_path.exists():
            self.error_log_path.write_text(
                "# 错题总览\n\n"
                "> 自动记录每次测验中的错误，按科目和知识点分类。\n\n"
                "## 错误类型标签\n"
                "- 🔴 **概念不清**：对定义/原理理解有误\n"
                "- 🟠 **记混**：与其他概念混淆\n"
                "- 🟡 **计算失误**：理解正确但计算出错\n"
                "- 🔵 **完全不会**：该知识点尚未掌握\n\n"
                "---\n\n"
                "## 记录列表\n\n"
                "| ID | 日期 | 科目 | 知识点 | 题目摘要 | 错误类型 | 次数 |\n"
                "|----|------|------|--------|---------|---------|------|\n"
                "| — | — | — | — | 暂无记录 | — | — |\n\n"
                "---\n\n"
                "## 按科目统计\n\n"
                "### 全部科目\n"
                "- 总错题数：0\n"
                "- 待重做：0\n"
                "- 已清除：0\n",
                encoding="utf-8"
            )

    def add_error(self, subject: str, topic: str, question: str,
                  user_answer: str, correct_answer: str, explanation: str,
                  error_type: str) -> tuple[str, int]:
        """添加一条错题记录，返回 (error_id, count)"""
        # 读取现有记录，找到最大 ID
        content = self.error_log_path.read_text(encoding="utf-8")
        existing_ids = re.findall(r'ERR-(\d+)', content)
        next_num = max([int(x) for x in existing_ids], default=0) + 1
        error_id = f"ERR-{next_num:03d}"

        today = date.today().isoformat()

        # 检查是否已有相同知识点的错题
        existing_count = 1
        pattern = rf'\|\s*ERR-\d+\s*\|\s*{re.escape(today)}\s*\|\s*{re.escape(subject)}\s*\|\s*{re.escape(topic)}\s*\|'
        matches = re.findall(pattern, content)
        if matches:
            # 找到最后一次的次数
            for line in content.split("\n"):
                if f"| {subject} | {topic} |" in line:
                    count_match = re.search(r'\|\s*(\d+)\s*\|$', line)
                    if count_match:
                        existing_count = int(count_match.group(1)) + 1

        # 在表格中插入新行（在 "暂无记录" 行之前或替换空行）
        new_row = f"| {error_id} | {today} | {subject} | {topic} | {question[:50]} | {error_type} | {existing_count} |"
        if "| — | — | — | — | 暂无记录 | — | — |" in content:
            content = content.replace(
                "| — | — | — | — | 暂无记录 | — | — |",
                new_row
            )
        else:
            # 在记录列表下方插入
            insert_marker = "| ID | 日期 | 科目 | 知识点 | 题目摘要 | 错误类型 | 次数 |"
            content = content.replace(
                insert_marker,
                insert_marker + "\n" + new_row
            )

        self.error_log_path.write_text(content, encoding="utf-8")

        # 保存详细错题记录
        by_topic_dir = self.errors_dir / "by-topic"
        by_topic_dir.mkdir(parents=True, exist_ok=True)
        topic_file = by_topic_dir / f"{subject}-{topic}.md"
        detail = (
            f"\n## {error_id} — {today}\n"
            f"**题目**：{question}\n\n"
            f"**你的答案**：{user_answer}\n\n"
            f"**正确答案**：{correct_answer}\n\n"
            f"**解析**：{explanation}\n\n"
            f"**错误类型**：{error_type}\n"
            f"**关联知识点**：[[{topic}]]\n\n"
            "---\n"
        )
        with open(topic_file, "a", encoding="utf-8") as f:
            f.write(detail)

        return error_id, existing_count

    def list_errors(self, subject: str = None, topic: str = None) -> list[dict]:
        """列出错题，支持按科目/知识点筛选"""
        content = self.error_log_path.read_text(encoding="utf-8")
        errors = []
        for line in content.split("\n"):
            if line.startswith("| ERR-"):
                parts = [p.strip() for p in line.split("|")[1:-1]]
                if len(parts) >= 6:
                    err = {
                        "id": parts[0],
                        "date": parts[1],
                        "subject": parts[2],
                        "topic": parts[3],
                        "summary": parts[4],
                        "error_type": parts[5],
                        "count": int(parts[6]) if len(parts) > 6 else 1,
                    }
                    if subject and err["subject"] != subject:
                        continue
                    if topic and err["topic"] != topic:
                        continue
                    errors.append(err)
        return errors

    def get_error_detail(self, error_id: str) -> Optional[str]:
        """获取错题详细内容"""
        by_topic_dir = self.errors_dir / "by-topic"
        if not by_topic_dir.exists():
            return None
        for f in by_topic_dir.iterdir():
            if f.suffix == ".md":
                content = f.read_text(encoding="utf-8")
                if error_id in content:
                    # 提取该错题的详细内容
                    sections = content.split(f"## {error_id}")
                    if len(sections) > 1:
                        detail = sections[1].split("---")[0]
                        return f"## {error_id}{detail}"
        return None

    def get_error_stats(self) -> dict:
        """获取错题统计数据"""
        errors = self.list_errors()
        stats = {
            "total": len(errors),
            "by_subject": {},
            "by_type": {},
            "by_topic": {},
            "pending": 0,
            "cleared": 0,
        }
        for e in errors:
            stats["by_subject"][e["subject"]] = stats["by_subject"].get(e["subject"], 0) + 1
            stats["by_type"][e["error_type"]] = stats["by_type"].get(e["error_type"], 0) + 1
            stats["by_topic"][e["topic"]] = stats["by_topic"].get(e["topic"], 0) + 1
        return stats

    # ========== 进度管理 ==========

    def get_progress(self) -> dict:
        """读取进度文件"""
        progress_path = self.progress_dir / "progress.md"
        if not progress_path.exists():
            return self._default_progress()
        content = progress_path.read_text(encoding="utf-8")
        return self._parse_progress(content)

    def save_progress(self, data: dict) -> None:
        """保存进度文件"""
        content = (
            f"# 复习进度看板\n\n"
            f"> 最后更新：{date.today().isoformat()}\n\n"
            f"## 各科进度\n\n"
            f"| 科目 | 资料数 | 已复习章节 | 总章节 | 正确率 | 掌握度 | 考试日期 |\n"
            f"|------|--------|-----------|--------|--------|--------|----------|\n"
        )
        for subj in data.get("subjects", []):
            content += (
                f"| {subj['name']} | {subj.get('materials', 0)} | "
                f"{subj.get('reviewed', 0)} | {subj.get('total', 0)} | "
                f"{subj.get('accuracy', '—')} | {subj.get('mastery', '⬜ 未开始')} | "
                f"{subj.get('exam_date', '未设置')} |\n"
            )
        content += (
            f"\n## 全局统计\n"
            f"- 总复习轮次：{data.get('total_rounds', 0)}\n"
            f"- 总答题数：{data.get('total_questions', 0)}\n"
            f"- 总正确率：{data.get('overall_accuracy', '—')}\n"
            f"- 错题总数：{data.get('total_errors', 0)}\n"
        )
        self.progress_dir.mkdir(parents=True, exist_ok=True)
        (self.progress_dir / "progress.md").write_text(content, encoding="utf-8")

    def _default_progress(self) -> dict:
        return {
            "subjects": [],
            "total_rounds": 0,
            "total_questions": 0,
            "overall_accuracy": "—",
            "total_errors": 0,
        }

    def _parse_progress(self, content: str) -> dict:
        """解析进度文件"""
        data = self._default_progress()
        # 解析科目行
        for line in content.split("\n"):
            if line.startswith("| ") and not line.startswith("| 科目"):
                parts = [p.strip() for p in line.split("|")[1:-1]]
                if len(parts) >= 7 and parts[0] and parts[0] != "—":
                    data["subjects"].append({
                        "name": parts[0],
                        "materials": parts[1],
                        "reviewed": parts[2],
                        "total": parts[3],
                        "accuracy": parts[4],
                        "mastery": parts[5],
                        "exam_date": parts[6],
                    })
        # 解析全局统计
        for line in content.split("\n"):
            if "总复习轮次" in line:
                m = re.search(r'(\d+)', line)
                if m: data["total_rounds"] = int(m.group(1))
            if "总答题数" in line:
                m = re.search(r'(\d+)', line)
                if m: data["total_questions"] = int(m.group(1))
            if "总正确率" in line:
                m = re.search(r'：(.+)', line)
                if m: data["overall_accuracy"] = m.group(1)
            if "错题总数" in line:
                m = re.search(r'(\d+)', line)
                if m: data["total_errors"] = int(m.group(1))
        return data

    # ========== 计划管理 ==========

    def get_plan(self) -> str:
        """读取复习计划"""
        plan_path = self.schedule_dir / "plan.md"
        if plan_path.exists():
            return plan_path.read_text(encoding="utf-8")
        return ""

    def save_plan(self, content: str) -> None:
        """保存复习计划"""
        self.schedule_dir.mkdir(parents=True, exist_ok=True)
        (self.schedule_dir / "plan.md").write_text(content, encoding="utf-8")

    # ========== 总结管理 ==========

    def save_summary(self, subdir: str, filename: str, content: str) -> Path:
        """保存总结文件"""
        d = self.summaries_dir / subdir
        d.mkdir(parents=True, exist_ok=True)
        filepath = d / filename
        filepath.write_text(content, encoding="utf-8")
        return filepath

    def list_summaries(self, subdir: str = None) -> list[dict]:
        """列出总结文件"""
        summaries = []
        base = self.summaries_dir
        if subdir:
            dirs = [base / subdir]
        else:
            dirs = [d for d in base.iterdir() if d.is_dir()]

        for d in dirs:
            if d.exists():
                for f in sorted(d.iterdir()):
                    if f.suffix == ".md":
                        summaries.append({
                            "type": d.name,
                            "filename": f.name,
                            "path": str(f.relative_to(self.base)),
                        })
        return summaries

    # ========== 辅助方法 ==========

    def _count_knowledge_items(self, filepath: Path) -> int:
        """统计知识点摘要中的条目数"""
        try:
            content = filepath.read_text(encoding="utf-8")
            # 统计以 - 或数字开头的列表项
            items = re.findall(r'^[\s]*[-*\d+\.]\s', content, re.MULTILINE)
            return len(items)
        except Exception:
            return 0

    def scan_coverage(self, subject: str = None) -> dict:
        """扫描知识覆盖度"""
        subjects = self.list_subjects()
        if subject:
            subjects = [s for s in subjects if s["name"] == subject]

        coverage = []
        for s in subjects:
            knowledge_content = self.read_knowledge(s["name"])
            used_count = self.get_used_count(s["name"])
            knowledge_items = s["knowledge_count"]
            coverage.append({
                "subject": s["name"],
                "materials": s["file_count"],
                "knowledge_items": knowledge_items,
                "questions_used": used_count,
                "coverage_pct": round(used_count / max(knowledge_items, 1) * 100, 1),
                "has_knowledge": knowledge_content is not None,
            })
        return coverage
