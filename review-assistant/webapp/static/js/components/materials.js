/* 资料管理页面 */

const MaterialsPage = {
  subjects: [],
  gen: 0,

  render() {
    return `
      <div class="page-header">
        <h1>📚 资料管理</h1>
        <p>提交课件/笔记/题库，AI 自动解析知识点结构</p>
      </div>

      <div class="panel">
        <h2>➕ 添加资料</h2>
        <div class="tab-bar">
          <div class="tab-item active" onclick="MaterialsPage.switchTab('file')">📁 上传文件</div>
          <div class="tab-item" onclick="MaterialsPage.switchTab('text')">📝 粘贴文本</div>
        </div>
        <div id="add-material-tab"></div>
      </div>

      <div id="scan-result"></div>

      <div class="panel">
        <div class="flex-between mb-2">
          <h2 style="border:none;margin:0;padding:0">📂 资料列表</h2>
          <div class="flex-gap">
            <button class="btn btn-sm" onclick="MaterialsPage.scan()">🔍 扫描覆盖度</button>
            <button class="btn btn-sm" onclick="MaterialsPage.refresh()">🔄 刷新</button>
          </div>
        </div>
        <div id="materials-list">
          <div class="loading-overlay"><span class="spinner"></span> 加载中...</div>
        </div>
      </div>`;
  },

  init(gen, pageName) {
    this.gen = gen;
    this.renderAddTab('file');
    this.loadSubjects();
  },

  switchTab(tab) {
    document.querySelectorAll('.tab-item').forEach(function(el, i) {
      el.classList.toggle('active', (i === 0 && tab === 'file') || (i === 1 && tab === 'text'));
    });
    this.renderAddTab(tab);
  },

  renderAddTab(tab) {
    var container = document.getElementById('add-material-tab');
    if (!container) return;
    if (tab === 'file') {
      container.innerHTML = `
        <div class="form-row">
          <div class="form-group">
            <label>科目名称</label>
            <input class="form-input" id="upload-subject" placeholder="例如: 数据结构、高等数学...">
          </div>
          <div class="form-group">
            <label>选择文件 (.md, .txt, .pdf)</label>
            <input class="form-input" type="file" id="upload-file" accept=".md,.txt,.pdf">
          </div>
          <div class="form-group" style="flex:0">
            <label>&nbsp;</label>
            <button class="btn btn-primary" onclick="MaterialsPage.upload()">📤 上传并解析</button>
          </div>
        </div>`;
    } else {
      container.innerHTML = `
        <div class="form-group">
          <label>科目名称</label>
          <input class="form-input" id="text-subject" placeholder="例如: 数据结构">
        </div>
        <div class="form-group">
          <label>资料内容 (支持 Markdown)</label>
          <textarea class="form-textarea" id="text-content" placeholder="在此粘贴课件/笔记内容..."></textarea>
        </div>
        <button class="btn btn-primary" onclick="MaterialsPage.addText()">📤 提交并解析</button>`;
    }
  },

  async upload() {
    var subjectEl = document.getElementById('upload-subject');
    var fileEl = document.getElementById('upload-file');
    if (!subjectEl || !fileEl) return;
    var subject = subjectEl.value.trim();
    var file = fileEl.files[0];

    if (!subject) { showToast('请输入科目名称', 'warning'); return; }
    if (!file) { showToast('请选择文件', 'warning'); return; }

    try {
      showToast('上传中...', 'info');
      await API.uploadMaterial(subject, file);
      showToast('已添加: ' + file.name, 'success');
      await API.parseMaterial(subject);
      showToast('知识点解析完成', 'success');
      this.loadSubjects();
    } catch (e) {
      showToast('上传失败: ' + e.message, 'error');
    }
  },

  async addText() {
    var subjectEl = document.getElementById('text-subject');
    var contentEl = document.getElementById('text-content');
    if (!subjectEl || !contentEl) return;
    var subject = subjectEl.value.trim();
    var content = contentEl.value.trim();

    if (!subject) { showToast('请输入科目名称', 'warning'); return; }
    if (!content) { showToast('请输入资料内容', 'warning'); return; }

    try {
      showToast('提交中...', 'info');
      await API.addTextMaterial(subject, content);
      showToast('资料已保存', 'success');
      await API.parseMaterial(subject);
      showToast('知识点解析完成', 'success');
      this.loadSubjects();
    } catch (e) {
      showToast('提交失败: ' + e.message, 'error');
    }
  },

  async loadSubjects() {
    try {
      var data = await API.getMaterials();
      var container = document.getElementById('materials-list');
      if (!container) return;  // 页面已切换
      this.subjects = data.subjects;
      this.renderList();
    } catch (e) {
      var container = document.getElementById('materials-list');
      if (container) container.innerHTML = '<div class="alert alert-error">加载失败: ' + e.message + '</div>';
    }
  },

  renderList() {
    var container = document.getElementById('materials-list');
    if (!container) return;
    if (!this.subjects.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <p>还没有添加任何资料</p>
          <p class="text-sm">上传课件或粘贴笔记，AI 将自动解析知识点</p>
        </div>`;
      return;
    }

    var html = '';
    for (var i = 0; i < this.subjects.length; i++) {
      var s = this.subjects[i];
      html += '<div class="card mb-2"><div class="flex-between"><div>';
      html += '<h3 style="margin:0 0 8px;color:var(--text)">📘 ' + s.name + '</h3>';
      html += '<div class="flex-gap text-sm text-dim">';
      html += '<span>📄 ' + s.file_count + ' 份资料</span>';
      html += '<span>📌 ' + s.knowledge_count + ' 个知识点</span>';
      html += s.file_count > 0 ? '<span class="tag tag-green">已解析</span>' : '<span class="tag tag-amber">待添加</span>';
      html += '</div></div>';
      html += '<button class="btn btn-sm btn-danger" onclick="MaterialsPage.deleteSubject(\'' + s.name + '\')">🗑️</button>';
      html += '</div>';
      if (s.files.length) {
        html += '<div class="mt-2">';
        for (var j = 0; j < s.files.length; j++) {
          html += '<div class="flex-between text-sm" style="padding:4px 0;color:var(--dim)"><span>📎 ' + s.files[j].name + '</span><span>' + (s.files[j].size / 1024).toFixed(1) + ' KB</span></div>';
        }
        html += '</div>';
      }
      html += '</div>';
    }
    container.innerHTML = html;
  },

  async scan() {
    try {
      var data = await API.scanMaterials();
      var container = document.getElementById('scan-result');
      if (!container) return;
      var coverage = data.coverage;
      var html = '<div class="panel"><h2>🔍 覆盖度扫描结果</h2>';
      if (!coverage.length) {
        html += '<p class="text-dim">暂无资料可扫描</p>';
      } else {
        html += '<table><tr><th>科目</th><th>资料数</th><th>知识点</th><th>已出题</th><th>覆盖率</th></tr>';
        for (var i = 0; i < coverage.length; i++) {
          var c = coverage[i];
          var cls = c.coverage_pct > 50 ? 'text-green' : c.coverage_pct > 20 ? 'text-amber' : 'text-red';
          html += '<tr><td>' + c.subject + '</td><td>' + c.materials + '</td><td>' + c.knowledge_items + '</td><td>' + c.questions_used + '</td><td class="' + cls + '">' + c.coverage_pct + '%</td></tr>';
        }
        html += '</table>';
      }
      html += '</div>';
      container.innerHTML = html;
    } catch (e) {
      showToast('扫描失败: ' + e.message, 'error');
    }
  },

  async deleteSubject(name) {
    if (!confirm('确定删除科目「' + name + '」的所有资料吗？')) return;
    for (var i = 0; i < this.subjects.length; i++) {
      if (this.subjects[i].name === name && this.subjects[i].files.length) {
        var files = this.subjects[i].files;
        for (var j = 0; j < files.length; j++) {
          try { await API.deleteMaterial(name, files[j].name); } catch (e) {}
        }
      }
    }
    showToast('已删除科目: ' + name, 'info');
    this.loadSubjects();
  },

  refresh: function() { this.loadSubjects(); },
};
