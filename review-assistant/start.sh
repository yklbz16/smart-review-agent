#!/bin/bash
# ==========================================
#  全科复习智能体 — 一键启动脚本
#  其他人拿到项目文件夹后，运行此脚本即可
# ==========================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WEBAPP_DIR="$SCRIPT_DIR/webapp"

echo "========================================"
echo "  全科复习智能体 v2.0"
echo "========================================"

# 1. 检查 Python
if ! command -v python3 &>/dev/null; then
    echo "❌ 未找到 python3，请先安装 Python 3.9+"
    echo "   Ubuntu/Debian: sudo apt install python3 python3-pip"
    echo "   macOS: brew install python3"
    exit 1
fi
echo "✅ Python: $(python3 --version)"

# 2. 安装/更新依赖
echo ""
echo "📦 检查依赖..."
pip3 install -r "$WEBAPP_DIR/requirements.txt" -q 2>/dev/null || {
    echo "⚠️  pip3 未找到，尝试 python3 -m pip..."
    python3 -m pip install -r "$WEBAPP_DIR/requirements.txt" -q
}
echo "✅ 依赖已就绪"

# 3. 初始化目录结构
echo ""
echo "📁 初始化数据目录..."
for dir in materials banks errors/by-topic summaries/mindmaps summaries/cheat-sheets progress schedule; do
    mkdir -p "$SCRIPT_DIR/$dir"
done

# 从模板创建 config.json（如果不存在）
if [ ! -f "$WEBAPP_DIR/config.json" ]; then
    cp "$WEBAPP_DIR/config.json.template" "$WEBAPP_DIR/config.json"
    echo "📝 已从模板创建 config.json"
fi
echo "✅ 数据目录已就绪"

# 4. 检查 API Key 是否已配置
API_KEY=$(python3 -c "import json; print(json.load(open('$WEBAPP_DIR/config.json')).get('api_key',''))" 2>/dev/null || echo "")
if [ -z "$API_KEY" ]; then
    echo ""
    echo "⚠️  尚未配置 API Key！"
    echo "   启动后请在浏览器中进入「⚙️ 模型设置」页面配置。"
    echo ""
fi

# 5. 获取本机 IP
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
echo ""
echo "========================================"
echo "  🚀 启动服务器"
echo "========================================"
echo ""
echo "  本机访问: http://localhost:8000"
if [ "$LOCAL_IP" != "localhost" ] && [ -n "$LOCAL_IP" ]; then
    echo "  局域网内: http://$LOCAL_IP:8000"
fi
echo ""
echo "  按 Ctrl+C 停止服务器"
echo "========================================"
echo ""

# 6. 启动
cd "$WEBAPP_DIR"
python3 -m uvicorn server:app --host 0.0.0.0 --port 8000
