/* 知识总结页面 */

const SummariesPage = {
  subjects: [],
  currentSubject: '',
  currentMode: '',
  gen: 0,

  render() {
    return `
      <div class="page-header">
        <h1>🧠 知识总结</h1>
        <p>AI帮你将零散知识点串联成体系化结构</p>
      </div>

      <div class="panel">
        <h2>🎯 生成总结</h2>
        <div id="summary-setup"></div>
      </div>

      <div id="summary-result"></div>`;
  },

  init(gen, pageName) {
    this.gen = gen;
    this.loadSubjects();
  },

  async loadSubjects() {
    try {
      var data = await API.getMaterials();
      var container = document.getElementById('summary-setup');
      if (!container) return;
      this.subjects = data.subjects.filter(function(s) { return s.file_count > 0; });
      this.renderSetup();
    } catch (e) {
      var container = document.getElementById('summary-setup');
      if (container) container.innerHTML = '<div class="alert alert-error">加载失败: ' + e.message + '</div>';
    }
  },

  renderSetup() {
    var container = document.getElementById('summary-setup');
    if (!container) return;

    if (!this.subjects.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <p>还没有添加任何资料</p>
          <p class="text-sm">请先到「资料管理」上传课件或笔记</p>
        </div>`;
      return;
    }

    var options = '<option value="">请选择...</option>';
    for (var i = 0; i < this.subjects.length; i++) {
      options += '<option value="' + this.subjects[i].name + '">' + this.subjects[i].name + '</option>';
    }

    var modes = [
      { id: 'chapter', icon: '📖', label: '章节总结', desc: '指定章节的结构化知识总结' },
      { id: 'mindmap', icon: '🗺️', label: '思维导图', desc: 'Mermaid 格式思维导图' },
      { id: 'compare', icon: '⚖️', label: '概念对比', desc: '两个概念的对比辨析' },
      { id: 'cheatsheet', icon: '📋', label: '考前速记单', desc: '1页高频考点精华' },
      { id: 'chain', icon: '🔗', label: '知识链', desc: '概念间的逻辑串联' },
    ];

    var modesHtml = '';
    for (var j = 0; j < modes.length; j++) {
      modesHtml += '<div class="card" style="cursor:pointer;flex:1;min-width:140px;text-align:center;padding:16px" id="summary-mode-' + modes[j].id + '" onclick="SummariesPage.selectMode(\'' + modes[j].id + '\', this)"><div style="font-size:2rem">' + modes[j].icon + '</div><div style="font-weight:600;margin:4px 0">' + modes[j].label + '</div><div class="text-sm text-dim">' + modes[j].desc + '</div></div>';
    }

    container.innerHTML = `
      <div class="form-group">
        <label>选择科目</label>
        <select class="form-select" id="summary-subject" onchange="SummariesPage.onSubjectChange()">
          ${options}
        </select>
      </div>
      <div class="mb-2" style="display:flex;gap:10px;flex-wrap:wrap">${modesHtml}</div>
      <div id="summary-extra-params"></div>
      <button class="btn btn-primary btn-lg mt-2" id="summary-generate-btn" onclick="SummariesPage.generate()" disabled>🚀 生成</button>`;
  },

  selectMode(mode, el) {
    var cards = document.querySelectorAll('[id^="summary-mode-"]');
    for (var i = 0; i < cards.length; i++) {
      cards[i].style.borderColor = 'var(--border)';
    }
    el.style.borderColor = 'var(--accent)';
    this.currentMode = mode;

    var btn = document.getElementById('summary-generate-btn');
    if (btn) btn.disabled = false;

    var extra = document.getElementById('summary-extra-params');
    if (!extra) return;

    if (mode === 'chapter') {
      extra.innerHTML = '<div class="form-group mt-2"><label>章节名称</label><input class="form-input" id="summary-chapter" placeholder="例如: 第3章 树与二叉树"></div>';
    } else if (mode === 'compare') {
      extra.innerHTML = '<div class="form-row mt-2"><div class="form-group"><label>概念 A</label><input class="form-input" id="summary-concept-a" placeholder="例如: 栈"></div><div class="form-group"><label>概念 B</label><input class="form-input" id="summary-concept-b" placeholder="例如: 队列"></div></div>';
    } else if (mode === 'chain') {
      extra.innerHTML = '<div class="form-group mt-2"><label>起始概念</label><input class="form-input" id="summary-start-concept" placeholder="例如: 二叉搜索树"></div>';
    } else {
      extra.innerHTML = '';
    }
  },

  onSubjectChange() {
    var el = document.getElementById('summary-subject');
    if (el) this.currentSubject = el.value;
  },

  async generate() {
    var subjectEl = document.getElementById('summary-subject');
    if (!subjectEl) return;
    var subject = subjectEl.value;
    if (!subject) { showToast('请选择科目', 'warning'); return; }
    if (!this.currentMode) { showToast('请选择总结模式', 'warning'); return; }

    var resultDiv = document.getElementById('summary-result');
    if (!resultDiv) return;
    resultDiv.innerHTML = '<div class="panel"><div class="loading-overlay"><span class="spinner"></span> AI 正在生成...</div></div>';

    try {
      var data;
      var mode = this.currentMode;
      if (mode === 'chapter') {
        var chEl = document.getElementById('summary-chapter');
        var chapter = (chEl && chEl.value) || '全部';
        data = await API.summaryChapter(subject, chapter);
      } else if (mode === 'mindmap') {
        data = await API.summaryMindmap(subject);
      } else if (mode === 'compare') {
        var aEl = document.getElementById('summary-concept-a');
        var bEl = document.getElementById('summary-concept-b');
        var a = (aEl && aEl.value) || '';
        var b = (bEl && bEl.value) || '';
        if (!a || !b) { showToast('请填写两个概念', 'warning'); return; }
        data = await API.summaryCompare(subject, a, b);
      } else if (mode === 'cheatsheet') {
        data = await API.summaryCheatsheet(subject);
      } else if (mode === 'chain') {
        var cEl = document.getElementById('summary-start-concept');
        var concept = (cEl && cEl.value) || '';
        if (!concept) { showToast('请填写起始概念', 'warning'); return; }
        data = await API.summaryChain(subject, concept);
      } else {
        data = await API.summaryMindmap(subject);
      }

      var resultDiv2 = document.getElementById('summary-result');
      if (!resultDiv2) return;

      var content = data.content;
      var mermaidHtml = '';
      var mermaidMatch = content.match(/```mermaid\n([\s\S]*?)```/);
      if (mermaidMatch) {
        mermaidHtml = '<div class="mermaid mt-2 mb-2" style="background:#fff;border-radius:8px;padding:16px">' + mermaidMatch[1] + '</div>';
        content = content.replace(/```mermaid\n[\s\S]*?```/, '');
      }

      var savedNote = data.filename ? '<div class="mt-2 text-sm text-dim">已保存至: summaries/' + data.filename + '</div>' : '';

      resultDiv2.innerHTML = '<div class="panel"><h2>📄 生成结果</h2>' + mermaidHtml + '<div class="markdown-content">' + renderMarkdown(content) + '</div>' + savedNote + '</div>';

      if (mermaidHtml && window.mermaid) {
        setTimeout(function() {
          try { mermaid.run({ querySelector: '.mermaid' }); } catch(e) {}
        }, 100);
      }
    } catch (e) {
      var resultDiv3 = document.getElementById('summary-result');
      if (resultDiv3) resultDiv3.innerHTML = '<div class="alert alert-error">生成失败: ' + e.message + '</div>';
    }
  },
};
