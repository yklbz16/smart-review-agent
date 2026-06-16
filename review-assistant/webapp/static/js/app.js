/* 主应用 — SPA 路由与导航 */

const App = {
  currentPage: 'materials',
  pageGen: 0,  // 分代计数器，解决页面切换竞态条件

  pages: {
    materials:  { icon: '📚', label: '资料管理', c: MaterialsPage },
    quiz:       { icon: '✍️', label: '测验抽背', c: QuizPage },
    errors:     { icon: '📝', label: '错题追踪', c: ErrorsPage },
    summaries:  { icon: '🧠', label: '知识总结', c: SummariesPage },
    progress:   { icon: '📈', label: '进度看板', c: ProgressPage },
    schedule:   { icon: '📅', label: '复习计划', c: SchedulePage },
    settings:   { icon: '⚙️', label: '模型设置', c: SettingsPage },
  },

  init() {
    this.renderSidebar();
    this.handleRoute();
    window.addEventListener('hashchange', () => this.handleRoute());
  },

  renderSidebar() {
    const nav = document.getElementById('sidebar-nav');
    let html = '';
    for (const [key, page] of Object.entries(this.pages)) {
      html += `
        <div class="nav-item" data-page="${key}" onclick="App.navigate('${key}')">
          <span class="icon">${page.icon}</span>
          <span>${page.label}</span>
        </div>`;
    }
    nav.innerHTML = html;
  },

  navigate(page) {
    window.location.hash = page;
  },

  handleRoute() {
    const hash = window.location.hash.slice(1) || 'materials';
    if (this.pages[hash]) {
      this.showPage(hash);
    } else {
      this.showPage('materials');
    }
  },

  showPage(name) {
    this.currentPage = name;
    this.pageGen++;  // 递增分代，使旧页面的异步回调失效
    var gen = this.pageGen;

    // Update nav active
    var navItems = document.querySelectorAll('.nav-item');
    for (var i = 0; i < navItems.length; i++) {
      navItems[i].classList.toggle('active', navItems[i].dataset.page === name);
    }
    // Render page
    var main = document.getElementById('main-content');
    var page = this.pages[name];
    var comp = page.c;  // 组件引用，保持 this 绑定正确
    document.title = page.label + ' — 全科复习智能体';
    main.innerHTML = '<div class="page active" id="page-' + name + '">' + comp.render() + '</div>';
    // Init page with error boundary (this 正确指向组件)
    if (comp.init) {
      try {
        comp.init(gen, name);
      } catch (e) {
        console.error('Page init error:', name, e);
      }
    }
  },

  // 安全获取元素：如果页面已切换则返回 null
  getEl(id, gen) {
    if (gen && gen !== this.pageGen) return null;
    return document.getElementById(id);
  },
};

// ====== 全局工具函数 ======

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className') el.className = v;
    else if (k === 'innerHTML') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v);
  }
  for (const c of children) {
    if (typeof c === 'string') el.appendChild(document.createTextNode(c));
    else if (c instanceof Node) el.appendChild(c);
  }
  return el;
}

function renderMarkdown(text) {
  if (!text) return '';
  // 转义 HTML 防止脚本注入
  let html = String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  // Code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Headers
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr>');
  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  // List items
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>');
  // Line breaks
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');
  // Wrap in paragraphs
  html = '<p>' + html + '</p>';
  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/<p>(\s*<h[1-4]>)/g, '$1');
  html = html.replace(/(<\/h[1-4]>)\s*<\/p>/g, '$1');

  return '<div class="markdown-content">' + html + '</div>';
}

function showToast(message, type) {
  type = type || 'info';
  var toast = document.createElement('div');
  toast.className = 'alert alert-' + type;
  toast.textContent = message;
  toast.style.cssText = 'position:fixed;top:20px;right:20px;z-index:2000;max-width:400px;animation:fadeIn 0.3s;';
  document.body.appendChild(toast);
  setTimeout(function() {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(function() { toast.remove(); }, 300);
  }, 3000);
}

// ====== 全局错误处理 ======
window.addEventListener('error', function(e) {
  console.error('Global error:', e.message, e.filename, e.lineno);
});

window.addEventListener('unhandledrejection', function(e) {
  console.error('Unhandled rejection:', e.reason);
});

// Init on DOM ready
document.addEventListener('DOMContentLoaded', function() { App.init(); });
