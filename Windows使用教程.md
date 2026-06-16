# 全科复习智能体 — Windows 使用教程

> 面向普通用户的图形化操作指南，无需编程基础。

---

## 一、下载项目

### 方法1：下载 ZIP（最简单）

1. 浏览器打开：https://github.com/yklbz16/-
2. 点击页面上的绿色 **<> Code** 按钮
3. 点击 **Download ZIP**
4. 下载完成后，**右键 ZIP 文件 → 解压到当前文件夹**
5. 得到文件夹 `-main`，右键重命名为 `review-assistant`

### 方法2：Git 克隆（如果已安装 Git）

```bash
git clone https://github.com/yklbz16/-.git
cd -
```

---

## 二、安装 Python

1. 浏览器打开：https://www.python.org/downloads/
2. 点击黄色 **Download Python 3.x.x** 按钮
3. 运行下载的安装程序
4. ⚠️ **务必勾选底部的「Add Python to PATH」**（这一步非常关键！）
5. 点击 **Install Now**，等待安装完成

> 验证安装：按 `Win + R`，输入 `cmd`，回车，输入 `python --version`，看到版本号即成功。

---

## 三、启动程序

### 3.1 打开命令提示符

按键盘 **Win + R**，输入 `cmd`，点击确定。

### 3.2 进入项目文件夹

假如下载的项目在桌面：

```
cd Desktop\review-assistant
```

> 快捷方法：在文件资源管理器里打开项目文件夹 → 点击地址栏 → 复制路径 → 在 cmd 里输入 `cd` + 空格 + 右键粘贴路径。

### 3.3 安装依赖（仅第一次需要）

```
pip install -r webapp\requirements.txt
```

等待约 1 分钟，看到 `Successfully installed ...` 即可。

如果提示 `pip 不是内部命令`，说明 Python 安装时没勾选 Add to PATH，重装 Python 并勾选即可。

### 3.4 启动服务器

```
python -m uvicorn webapp.server:app --host 0.0.0.0 --port 8000
```

看到以下信息表示启动成功：

```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

> ⚠️ **这个黑色窗口不能关闭！** 关闭窗口就等于关闭了服务器。

---

## 四、开始使用

1. 打开浏览器，地址栏输入：**http://localhost:8000**
2. 看到复习智能体主界面（深色背景）
3. 点击左侧 **⚙️ 模型设置**
4. 选择提供商（DeepSeek / OpenAI / Anthropic 等）
5. 填入你的 **API Key**
6. 填写 **模型名称**
7. 点击 **🔍 测试连接**，看到 ✅ 即成功
8. 点击 **💾 保存配置**
9. 回到 📚 **资料管理**，上传课件或粘贴笔记
10. 切换到 ✍️ **测验抽背**，选择科目和模式，开始复习！

---

## 五、每次使用

以后每次使用只需要两步：

1. 打开 cmd，进入项目文件夹
2. 输入 `python -m uvicorn webapp.server:app --host 0.0.0.0 --port 8000`
3. 浏览器打开 `http://localhost:8000`

---

## 六、局域网共享（手机/平板也能用）

让家里的手机、平板也能访问复习助手（须连同一个 Wi-Fi）。

### 6.1 查看电脑 IP

**方法一（图形化）：**
1. 打开 **设置 → 网络和 Internet → Wi-Fi**
2. 点击已连接的 Wi-Fi 名称
3. 翻到最下面，找到 **IPv4 地址**，如 `192.168.1.105`

**方法二（命令行）：**
按 `Win + R`，输入 `cmd`，输入 `ipconfig`，找到 `IPv4 地址`。

### 6.2 放行 Windows 防火墙

**方法一（命令行，推荐）：**
右键开始菜单 → **终端(管理员)** 或 **命令提示符(管理员)**，输入：

```
netsh advfirewall firewall add rule name="复习助手" dir=in action=allow protocol=TCP localport=8000
```

**方法二（图形化）：**
1. 按 `Win + R`，输入 `wf.msc`，回车
2. 点击左侧 **入站规则**
3. 点击右侧 **新建规则...**
4. 选择 **端口** → 下一步
5. 选择 **TCP**，输入 **8000** → 下一步
6. 选择 **允许连接** → 下一步
7. 三个选项全部勾选 → 下一步
8. 名称填写 `复习助手` → 完成

### 6.3 其他设备访问

确保手机/平板和电脑连接**同一个 Wi-Fi**，打开浏览器输入：

```
http://你的IP地址:8000
```

例如：`http://192.168.1.105:8000`

| 设备 | 操作 |
|------|------|
| iPhone | Safari 打开地址 → 分享按钮 → **添加到主屏幕** |
| Android | Chrome 打开地址 → 菜单 → **添加到主屏幕** |
| 平板 | 同手机操作 |
| 另一台电脑 | 浏览器直接输入地址 |

> ⚠️ 电脑不能关机或休眠，否则手机无法访问。
> ⚠️ 重启路由器后 IP 地址可能变化，需要重新查看一次。

---

## 七、切换大模型

进入 ⚙️ **模型设置** 页面即可切换：

| 提供商 | 需要填写 | 获取 Key 地址 |
|--------|----------|---------------|
| DeepSeek | API Key + Model | [platform.deepseek.com](https://platform.deepseek.com) |
| OpenAI | API Key + Model | [platform.openai.com](https://platform.openai.com) |
| Anthropic | API Key + Model | [console.anthropic.com](https://console.anthropic.com) |
| 自定义 | API Key + Base URL + Model | 任意兼容 OpenAI 接口的服务 |

切换后无需重启，立即生效。

---

## 八、常见问题

| 问题 | 解决方法 |
|------|----------|
| `pip 不是内部命令` | 重装 Python，**一定要勾选 Add to PATH** |
| `ModuleNotFoundError` | 重新执行 `pip install -r webapp\requirements.txt` |
| 浏览器打不开 localhost | 确认黑色 cmd 窗口还在运行，地址是 `localhost` 不是 `local host` |
| 测验/总结无法生成 | 去模型设置页面，点 **测试连接**，检查 API Key 是否正确 |
| 手机无法访问 | 检查：1)同一Wi-Fi 2)防火墙已放行 3)IP地址正确 4)电脑未休眠 |
| 页面一直"加载中" | 按 `Ctrl + Shift + R` 强制刷新浏览器 |
| 端口被占用 | 改启动命令最后端口号，如 `--port 8001`，访问时也用新端口 |
| 想关闭服务器 | 在黑色 cmd 窗口按 `Ctrl + C`，或直接关闭窗口 |

---

## 九、功能一览

| 模块 | 功能 |
|------|------|
| 📚 资料管理 | 上传课件/笔记，AI 自动解析知识点 |
| ✍️ 测验抽背 | 6种出题模式，AI 即时评分纠错 |
| 📝 错题追踪 | 自动记录错题，按知识点分类统计 |
| 🧠 知识总结 | 思维导图、速记单、概念对比、知识链 |
| 📈 进度看板 | 掌握度可视化、考试倒计时、AI 建议 |
| 📅 复习计划 | AI 生成每日复习安排 |
| ⚙️ 模型设置 | 自由切换大模型，支持多家厂商 |
