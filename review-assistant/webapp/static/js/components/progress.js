/* 进度看板页面 */

const ProgressPage = {
  data: null,
  gen: 0,

  render() {
    return `
      <div class="page-header">
        <h1>📈 进度看板</h1>
        <p>掌握度可视化、考试倒计时、AI智能建议</p>
      </div>

      <div class="panel">
        <h2>📊 复习进度总览</h2>
        <div id="progress-overview">
          <div class="loading-overlay"><span class="spinner"></span> 加载中...</div>
        </div>
      </div>

      <div class="panel">
        <h2>➕ 设置考试日期</h2>
        <div class="form-row">
          <div class="form-group">
            <label>科目</label>
            <input class="form-input" id="exam-subject" placeholder="科目名称">
          </div>
          <div class="form-group">
            <label>考试日期</label>
            <input class="form-input" type="date" id="exam-date">
          </div>
          <div class="form-group" style="flex:0">
            <label>&nbsp;</label>
            <button class="btn btn-primary" onclick="ProgressPage.setExam()">📅 设置</button>
          </div>
        </div>
      </div>

      <div id="ai-suggestion-panel"></div>`;
  },

  init(gen, pageName) {
    this.gen = gen;
    this.load();
    this.loadSuggestion();
  },

  async load() {
    try {
      this.data = await API.getProgress();
      var container = document.getElementById('progress-overview');
      if (!container) return;
      this.renderOverview();
    } catch (e) {
      var container = document.getElementById('progress-overview');
      if (container) container.innerHTML = '<div class="alert alert-error">加载失败: ' + e.message + '</div>';
    }
  },

  renderOverview() {
    var d = this.data;
    var container = document.getElementById('progress-overview');
    if (!container) return;

    if (!d.subjects.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <p>暂无复习数据</p>
          <p class="text-sm">添加资料并开始测验后，进度会自动更新</p>
        </div>`;
      return;
    }

    var subjectRows = '';
    for (var i = 0; i < d.subjects.length; i++) {
      var s = d.subjects[i];
      var masteryIcon = '⬜';
      if (s.mastery.indexOf('薄弱') >= 0) masteryIcon = '🔴';
      else if (s.mastery.indexOf('中等') >= 0) masteryIcon = '🟡';
      else if (s.mastery.indexOf('良好') >= 0 || s.mastery.indexOf('优秀') >= 0) masteryIcon = '🟢';

      var accuracy = s.accuracy !== '—' ? parseFloat(s.accuracy) : 0;
      var barColor = accuracy >= 80 ? 'green' : accuracy >= 60 ? 'amber' : 'red';
      var barWidth = accuracy || 0;

      var countdown = '';
      if (s.exam_date && s.exam_date !== '未设置') {
        var days = Math.ceil((new Date(s.exam_date) - new Date()) / (1000 * 60 * 60 * 24));
        if (days > 0) {
          var tagClass = days <= 7 ? 'tag-red' : days <= 30 ? 'tag-amber' : 'tag-green';
          countdown = '<span class="tag ' + tagClass + '">距考试 ' + days + ' 天</span>';
        } else if (days === 0) {
          countdown = '<span class="tag tag-red">今天考试!</span>';
        } else {
          countdown = '<span class="tag tag-purple">已结束</span>';
        }
      }

      var progressBar = accuracy > 0 ? '<div class="progress-bar"><div class="progress-fill ' + barColor + '" style="width:' + barWidth + '%"></div></div>' : '';

      subjectRows += '<div class="card mb-2">' +
        '<div class="flex-between mb-1"><div><strong>📘 ' + s.name + '</strong> ' + countdown + '</div><span>' + masteryIcon + ' ' + s.mastery + '</span></div>' +
        '<div class="flex-between text-sm text-dim mb-1"><span>📄 ' + s.materials + ' 份资料</span><span>📖 ' + s.reviewed + '/' + s.total + ' 章节</span><span>🎯 正确率: ' + s.accuracy + '</span><span>📅 ' + s.exam_date + '</span></div>' +
        progressBar + '</div>';
    }

    container.innerHTML = `
      <div class="card-grid mb-2">
        <div class="card" style="text-align:center">
          <div style="font-size:2rem;color:var(--accent)">${d.total_rounds}</div>
          <div class="text-sm text-dim">总复习轮次</div>
        </div>
        <div class="card" style="text-align:center">
          <div style="font-size:2rem;color:var(--accent)">${d.total_questions}</div>
          <div class="text-sm text-dim">总答题数</div>
        </div>
        <div class="card" style="text-align:center">
          <div style="font-size:2rem;color:${d.overall_accuracy !== '—' && parseFloat(d.overall_accuracy) >= 70 ? 'var(--green)' : 'var(--amber)'}">${d.overall_accuracy}</div>
          <div class="text-sm text-dim">总正确率</div>
        </div>
        <div class="card" style="text-align:center">
          <div style="font-size:2rem;color:var(--red)">${d.total_errors}</div>
          <div class="text-sm text-dim">错题总数</div>
        </div>
      </div>
      <h3 style="margin-top:16px;margin-bottom:8px;color:var(--dim)">各科详情</h3>
      ${subjectRows}`;
  },

  async setExam() {
    var subjectEl = document.getElementById('exam-subject');
    var dateEl = document.getElementById('exam-date');
    if (!subjectEl || !dateEl) return;
    var subject = subjectEl.value.trim();
    var date = dateEl.value;

    if (!subject) { showToast('请输入科目名称', 'warning'); return; }
    if (!date) { showToast('请选择考试日期', 'warning'); return; }

    try {
      await API.setExamDate(subject, date);
      showToast('✅ ' + subject + ' 考试日期已设置为 ' + date, 'success');
      this.load();
    } catch (e) {
      showToast('设置失败: ' + e.message, 'error');
    }
  },

  async loadSuggestion() {
    try {
      var data = await API.getProgress();
      var container = document.getElementById('ai-suggestion-panel');
      if (!container) return;
      if (!data.subjects.length) return;

      var suggestion = '';
      var now = new Date();

      for (var i = 0; i < data.subjects.length; i++) {
        var s = data.subjects[i];
        if (s.exam_date && s.exam_date !== '未设置') {
          var days = Math.ceil((new Date(s.exam_date) - now) / (1000 * 60 * 60 * 24));
          if (days <= 7) {
            suggestion += '⏰ **' + s.name + '** 仅剩 ' + days + ' 天，建议进入冲刺模式：主攻薄弱点专练 + 速记单。\n\n';
          } else if (days <= 30) {
            suggestion += '📋 **' + s.name + '** 还有 ' + days + ' 天，建议系统复习：按章节推进 + 每周综合模拟。\n\n';
          }
        }
      }

      if (!suggestion) {
        suggestion = '💡 先设置考试日期，AI 将给出个性化复习建议。\n\n建议：添加资料 → 开始测验 → 查看错题 → 生成总结，形成完整复习闭环。';
      }

      container.innerHTML = '<div class="panel"><h2>💡 AI 复习建议</h2><div class="markdown-content">' + renderMarkdown(suggestion) + '</div></div>';
    } catch (e) { /* ignore */ }
  },
};
