/* 复习计划页面 */

const SchedulePage = {
  data: null,
  gen: 0,

  render() {
    return `
      <div class="page-header">
        <h1>📅 复习计划</h1>
        <p>根据考试日期 + 当前进度 + 掌握度，智能生成每日复习计划</p>
      </div>

      <div class="panel">
        <h2>📋 当前进度摘要</h2>
        <div id="schedule-summary">
          <div class="loading-overlay"><span class="spinner"></span> 加载中...</div>
        </div>
      </div>

      <div class="panel">
        <div class="flex-between mb-2">
          <h2 style="border:none;margin:0;padding:0">📅 复习计划</h2>
          <button class="btn btn-primary" onclick="SchedulePage.generate()">🤖 AI 生成计划</button>
        </div>
        <div id="schedule-content">
          <div class="empty-state">
            <div class="empty-icon">📋</div>
            <p>点击「AI 生成计划」按钮生成个性化复习计划</p>
          </div>
        </div>
      </div>`;
  },

  init(gen, pageName) {
    this.gen = gen;
    this.loadSummary();
  },

  async loadSummary() {
    try {
      var data = await API.getProgress();
      var container = document.getElementById('schedule-summary');
      if (!container) return;
      this.data = data;

      if (!data.subjects.length) {
        container.innerHTML = '<div class="empty-state"><p class="text-dim">暂无复习数据。请先添加资料并开始测验。</p></div>';
        return;
      }

      var rows = '';
      for (var i = 0; i < data.subjects.length; i++) {
        var s = data.subjects[i];
        var countdown = '—';
        if (s.exam_date && s.exam_date !== '未设置') {
          var days = Math.ceil((new Date(s.exam_date) - new Date()) / (1000 * 60 * 60 * 24));
          countdown = days > 0 ? days + ' 天' : days === 0 ? '今天!' : '已过';
        }
        rows += '<tr><td><strong>' + s.name + '</strong></td><td>' + s.reviewed + '/' + s.total + '</td><td>' + s.accuracy + '</td><td>' + s.mastery + '</td><td>' + s.exam_date + '</td><td>' + countdown + '</td></tr>';
      }

      container.innerHTML = '<table><tr><th>科目</th><th>进度</th><th>正确率</th><th>掌握度</th><th>考试日期</th><th>倒计时</th></tr>' + rows + '</table>';
    } catch (e) {
      var container = document.getElementById('schedule-summary');
      if (container) container.innerHTML = '<div class="alert alert-error">加载失败: ' + e.message + '</div>';
    }
  },

  async generate() {
    var content = document.getElementById('schedule-content');
    if (!content) return;
    content.innerHTML = '<div class="loading-overlay"><span class="spinner"></span> AI 正在生成个性化复习计划...</div>';

    try {
      var data = await API.generateSchedule();
      var content2 = document.getElementById('schedule-content');
      if (!content2) return;
      content2.innerHTML = '<div class="card"><div class="markdown-content">' + renderMarkdown(data.content) + '</div></div><div class="mt-2 text-sm text-dim">计划已保存至 schedule/plan.md</div>';
      showToast('✅ 复习计划已生成', 'success');
    } catch (e) {
      var content3 = document.getElementById('schedule-content');
      if (content3) content3.innerHTML = '<div class="alert alert-error">生成失败: ' + e.message + '</div>';
    }
  },
};
