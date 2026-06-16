/* 错题追踪页面 */

const ErrorsPage = {
  errors: [],
  stats: null,
  filterSubject: '',
  filterTopic: '',
  gen: 0,

  render() {
    return `
      <div class="page-header">
        <h1>📝 错题追踪</h1>
        <p>自动记录每次错误，按知识点分类、错误类型标注，精准定位薄弱环节</p>
      </div>

      <div class="panel" id="error-stats-panel">
        <h2>📊 统计概览</h2>
        <div id="error-stats"><div class="loading-overlay"><span class="spinner"></span> 加载中...</div></div>
      </div>

      <div class="panel">
        <div class="flex-between mb-2">
          <h2 style="border:none;margin:0;padding:0">📋 错题列表</h2>
          <div class="flex-gap">
            <select class="form-select" id="error-filter-subject" style="width:auto" onchange="ErrorsPage.applyFilter()">
              <option value="">全部科目</option>
            </select>
            <button class="btn btn-sm" onclick="ErrorsPage.review()">🔄 重做错题</button>
            <button class="btn btn-sm" onclick="ErrorsPage.refresh()">🔄 刷新</button>
          </div>
        </div>
        <div id="error-list"><div class="loading-overlay"><span class="spinner"></span> 加载中...</div></div>
      </div>
      <div id="review-panel"></div>`;
  },

  init(gen, pageName) {
    this.gen = gen;
    this.loadStats();
    this.loadErrors();
    this.loadSubjects();
  },

  async loadStats() {
    try {
      this.stats = await API.getErrorStats();
      var container = document.getElementById('error-stats');
      if (!container) return;
      this.renderStats();
    } catch (e) {
      var container = document.getElementById('error-stats');
      if (container) container.innerHTML = '<div class="alert alert-error">加载失败</div>';
    }
  },

  renderStats() {
    var s = this.stats;
    if (!s) return;
    var container = document.getElementById('error-stats');
    if (!container) return;

    var bySubjectHtml = '';
    var keys = Object.keys(s.by_subject);
    for (var i = 0; i < keys.length; i++) {
      bySubjectHtml += '<div class="flex-between text-sm"><span>' + keys[i] + '</span><span class="tag tag-red">' + s.by_subject[keys[i]] + '题</span></div>';
    }
    if (!bySubjectHtml) bySubjectHtml = '<div class="text-dim text-sm">暂无数据</div>';

    var typeTags = { '概念不清': 'tag-red', '记混': 'tag-amber', '计算失误': 'tag-blue', '完全不会': 'tag-purple' };
    var byTypeHtml = '';
    var typeKeys = Object.keys(s.by_type);
    for (var j = 0; j < typeKeys.length; j++) {
      var tagCls = typeTags[typeKeys[j]] || 'tag-red';
      byTypeHtml += '<div class="flex-between text-sm"><span>' + typeKeys[j] + '</span><span class="tag ' + tagCls + '">' + s.by_type[typeKeys[j]] + '题</span></div>';
    }
    if (!byTypeHtml) byTypeHtml = '<div class="text-dim text-sm">暂无数据</div>';

    var sorted = Object.entries(s.by_topic).sort(function(a, b) { return b[1] - a[1]; });
    var top5Html = '';
    for (var k = 0; k < Math.min(5, sorted.length); k++) {
      top5Html += '<div class="flex-between text-sm"><span>' + sorted[k][0] + '</span><span>' + sorted[k][1] + '次</span></div>';
    }
    if (!top5Html) top5Html = '<div class="text-dim text-sm">暂无数据</div>';

    container.innerHTML = `
      <div class="card-grid">
        <div class="card" style="text-align:center">
          <div style="font-size:2rem;color:var(--accent);font-weight:bold">${s.total}</div>
          <div class="text-sm text-dim">总错题数</div>
        </div>
        <div class="card">
          <h4 style="margin:0 0 8px;color:var(--dim)">按科目分布</h4>
          ${bySubjectHtml}
        </div>
        <div class="card">
          <h4 style="margin:0 0 8px;color:var(--dim)">按错误类型</h4>
          ${byTypeHtml}
        </div>
        <div class="card">
          <h4 style="margin:0 0 8px;color:var(--dim)">高频错题 Top5</h4>
          ${top5Html}
        </div>
      </div>`;
  },

  async loadErrors() {
    try {
      var data = await API.getErrors(this.filterSubject, this.filterTopic);
      var container = document.getElementById('error-list');
      if (!container) return;
      this.errors = data.errors;
      this.renderList();
    } catch (e) {
      var container = document.getElementById('error-list');
      if (container) container.innerHTML = '<div class="alert alert-error">加载失败: ' + e.message + '</div>';
    }
  },

  async loadSubjects() {
    try {
      var data = await API.getMaterials();
      var select = document.getElementById('error-filter-subject');
      if (!select) return;
      for (var i = 0; i < data.subjects.length; i++) {
        var opt = document.createElement('option');
        opt.value = data.subjects[i].name;
        opt.textContent = data.subjects[i].name;
        select.appendChild(opt);
      }
    } catch (e) { /* ignore */ }
  },

  renderList() {
    var container = document.getElementById('error-list');
    if (!container) return;
    if (!this.errors.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎉</div>
          <p>暂无错题记录</p>
          <p class="text-sm">做一次测验，错题会自动记录到这里</p>
        </div>`;
      return;
    }

    var typeTags = { '概念不清': 'tag-red', '记混': 'tag-amber', '计算失误': 'tag-blue', '完全不会': 'tag-purple' };
    var rows = '';
    for (var i = 0; i < this.errors.length; i++) {
      var e = this.errors[i];
      var tagCls = typeTags[e.error_type] || 'tag-red';
      rows += '<tr>' +
        '<td><code>' + e.id + '</code></td>' +
        '<td>' + e.date + '</td>' +
        '<td><span class="tag tag-blue">' + e.subject + '</span></td>' +
        '<td>' + e.topic + '</td>' +
        '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + e.summary + '</td>' +
        '<td><span class="tag ' + tagCls + '">' + e.error_type + '</span></td>' +
        '<td>' + e.count + '</td>' +
        '<td><button class="btn btn-sm" onclick="ErrorsPage.showDetail(\'' + e.id + '\')">📋</button> ' +
        '<button class="btn btn-sm btn-danger" onclick="ErrorsPage.clear(\'' + e.id + '\')">✅</button></td>' +
        '</tr>';
    }

    container.innerHTML = `
      <div class="table-wrap">
        <table>
          <tr><th>ID</th><th>日期</th><th>科目</th><th>知识点</th><th>题目摘要</th><th>错误类型</th><th>次数</th><th>操作</th></tr>
          ${rows}
        </table>
      </div>`;
  },

  async showDetail(id) {
    try {
      var data = await API.getErrorDetail(id);
      var container = document.getElementById('review-panel');
      if (!container) return;
      container.innerHTML = '<div class="panel mt-2"><h2>错题详情: ' + id + '</h2>' + renderMarkdown(data.detail) + '</div>';
    } catch (e) {
      showToast('加载失败: ' + e.message, 'error');
    }
  },

  async clear(id) {
    if (!confirm('确定将错题 ' + id + ' 标记为已清除？')) return;
    try {
      await API.clearError(id);
      showToast('错题 ' + id + ' 已清除', 'success');
      this.refresh();
    } catch (e) {
      showToast('操作失败: ' + e.message, 'error');
    }
  },

  async review() {
    if (!this.errors.length) { showToast('没有可重做的错题', 'info'); return; }
    try {
      var data = await API.reviewErrors({ subject: this.filterSubject, topic: this.filterTopic });
      var container = document.getElementById('review-panel');
      if (!container) return;
      container.innerHTML = '<div class="panel mt-2"><h2>🔄 错题重做</h2>' + renderMarkdown(data.questions) +
        '<div class="form-group mt-2"><textarea class="form-textarea" id="review-answer" placeholder="在此作答..."></textarea></div>' +
        '<button class="btn btn-primary" onclick="ErrorsPage.submitReview()">📝 提交</button></div>';
    } catch (e) {
      showToast('生成失败: ' + e.message, 'error');
    }
  },

  async submitReview() {
    var answerEl = document.getElementById('review-answer');
    if (!answerEl) return;
    var answer = answerEl.value;
    if (!answer) { showToast('请输入答案', 'warning'); return; }
    try {
      var data = await API.gradeQuiz({
        subject: this.filterSubject || '',
        topic: 'review',
        question: '错题重做',
        user_answer: answer,
        correct_answer: '',
      });
      showToast(data.is_correct ? '✅ 回答正确！' : '❌ 还有待改进', data.is_correct ? 'success' : 'warning');
      this.refresh();
    } catch (e) {
      showToast('批改失败: ' + e.message, 'error');
    }
  },

  applyFilter() {
    var select = document.getElementById('error-filter-subject');
    if (!select) return;
    this.filterSubject = select.value;
    this.loadErrors();
  },

  refresh: function() {
    this.loadStats();
    this.loadErrors();
  },
};
