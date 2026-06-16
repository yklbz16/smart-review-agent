/* 测验抽背页面 */

const QuizPage = {
  subjects: [],
  currentSubject: '',
  currentMode: 'concept',
  questionsText: '',
  gen: 0,

  modes: [
    { id: 'concept', name: '💡 概念简答', desc: '核心概念的定义、原理或辨析' },
    { id: 'blank', name: '📝 填空', desc: '挖掉关键术语/公式，逐空填写' },
    { id: 'mixed', name: '📋 混合模拟卷', desc: '混合题型，模拟真实考试' },
    { id: 'weak', name: '🎯 薄弱点专练', desc: '针对高频错误知识点出题' },
    { id: 'quick', name: '⚡ 闪卡速刷', desc: '快速翻卡，自评掌握度' },
  ],

  render() {
    return `
      <div class="page-header">
        <h1>✍️ 测验抽背</h1>
        <p>6种出题模式，AI即时评分+纠错，错题自动入库</p>
      </div>

      <div class="panel" id="quiz-setup-panel">
        <h2>🎯 开始测验</h2>
        <div id="quiz-setup"></div>
      </div>

      <div class="panel hidden" id="quiz-panel">
        <div class="flex-between mb-2">
          <h2 style="border:none;margin:0;padding:0" id="quiz-title">测验中...</h2>
          <button class="btn btn-sm" onclick="QuizPage.reset()">🔄 重新选择</button>
        </div>
        <div class="progress-bar mb-2"><div class="progress-fill blue" style="width:0%" id="quiz-progress"></div></div>
        <div id="quiz-content"></div>
      </div>`;
  },

  init(gen, pageName) {
    this.gen = gen;
    this.loadSubjects();
  },

  async loadSubjects() {
    try {
      var data = await API.getMaterials();
      var container = document.getElementById('quiz-setup');
      if (!container) return;
      this.subjects = data.subjects.filter(function(s) { return s.file_count > 0; });
      this.renderSetup();
    } catch (e) {
      var container = document.getElementById('quiz-setup');
      if (container) container.innerHTML = '<div class="alert alert-error">加载失败: ' + e.message + '</div>';
    }
  },

  renderSetup() {
    var container = document.getElementById('quiz-setup');
    if (!container) return;

    if (!this.subjects.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <p>还没有添加任何资料</p>
          <p class="text-sm">请先到「资料管理」上传课件或笔记</p>
          <button class="btn btn-primary mt-2" onclick="App.navigate('materials')">📚 去添加资料</button>
        </div>`;
      return;
    }

    var options = '';
    for (var i = 0; i < this.subjects.length; i++) {
      options += '<option value="' + this.subjects[i].name + '">' + this.subjects[i].name + ' (' + this.subjects[i].knowledge_count + '个知识点)</option>';
    }

    var modesHtml = '';
    for (var j = 0; j < this.modes.length; j++) {
      var m = this.modes[j];
      var borderColor = j === 0 ? 'var(--accent)' : 'var(--border)';
      var textColor = j === 0 ? 'var(--accent)' : 'var(--text)';
      modesHtml += '<div class="card" style="cursor:pointer;margin-bottom:8px;border-color:' + borderColor + '" onclick="QuizPage.selectMode(\'' + m.id + '\', this)"><h4 style="margin:0 0 4px;color:' + textColor + '">' + m.name + '</h4><p style="margin:0;color:var(--dim);font-size:0.85rem">' + m.desc + '</p></div>';
    }

    container.innerHTML = `
      <div class="form-row mb-2">
        <div class="form-group">
          <label>选择科目</label>
          <select class="form-select" id="quiz-subject">${options}</select>
        </div>
        <div class="form-group" style="flex:0;min-width:100px">
          <label>题数</label>
          <input class="form-input" type="number" id="quiz-count" value="5" min="1" max="30" style="width:80px">
        </div>
      </div>
      <div class="mb-2" id="quiz-mode-selector">${modesHtml}</div>
      <button class="btn btn-primary btn-lg" onclick="QuizPage.start()">🚀 开始测验</button>`;
  },

  selectMode(modeId, el) {
    this.currentMode = modeId;
    var cards = document.querySelectorAll('#quiz-mode-selector .card');
    for (var i = 0; i < cards.length; i++) {
      cards[i].style.borderColor = 'var(--border)';
      cards[i].querySelector('h4').style.color = 'var(--text)';
    }
    el.style.borderColor = 'var(--accent)';
    el.querySelector('h4').style.color = 'var(--accent)';
  },

  async start() {
    var subjectEl = document.getElementById('quiz-subject');
    var countEl = document.getElementById('quiz-count');
    if (!subjectEl || !countEl) return;
    var subject = subjectEl.value;
    var count = parseInt(countEl.value) || 5;

    if (!subject) { showToast('请选择科目', 'warning'); return; }

    this.currentSubject = subject;

    var setupPanel = document.getElementById('quiz-setup-panel');
    var quizPanel = document.getElementById('quiz-panel');
    if (!setupPanel || !quizPanel) return;
    setupPanel.classList.add('hidden');
    quizPanel.classList.remove('hidden');

    var modeName = '测验';
    for (var i = 0; i < this.modes.length; i++) {
      if (this.modes[i].id === this.currentMode) { modeName = this.modes[i].name; break; }
    }
    var titleEl = document.getElementById('quiz-title');
    if (titleEl) titleEl.textContent = modeName + ' — ' + subject;

    var content = document.getElementById('quiz-content');
    if (!content) return;
    content.innerHTML = '<div class="loading-overlay"><span class="spinner"></span> AI 正在出题中...</div>';

    try {
      var data = await API.generateQuiz({
        subject: subject,
        mode: this.currentMode,
        count: count,
      });
      this.questionsText = data.questions_text;
      this.renderQuestions();
    } catch (e) {
      var content = document.getElementById('quiz-content');
      if (content) content.innerHTML = '<div class="alert alert-error">出题失败: ' + e.message + '</div>';
    }
  },

  renderQuestions() {
    var content = document.getElementById('quiz-content');
    if (!content) return;
    content.innerHTML = `
      <div class="quiz-question" style="white-space:pre-wrap;font-size:1.05rem;line-height:1.8;">
        ${this.questionsText}
      </div>
      <div class="form-group">
        <label>✏️ 你的答案</label>
        <textarea class="form-textarea" id="quiz-answer" placeholder="在此输入你的答案..."></textarea>
      </div>
      <div class="flex-gap">
        <button class="btn btn-primary" onclick="QuizPage.grade()">📝 提交批改</button>
        <button class="btn" onclick="QuizPage.start()">🔄 换一批题</button>
        <button class="btn" onclick="QuizPage.reset()">↩️ 重新选择</button>
      </div>
      <div id="grading-result"></div>`;
  },

  async grade() {
    var answerEl = document.getElementById('quiz-answer');
    if (!answerEl) return;
    var answer = answerEl.value.trim();
    if (!answer) { showToast('请先输入答案', 'warning'); return; }

    var resultDiv = document.getElementById('grading-result');
    if (!resultDiv) return;
    resultDiv.innerHTML = '<div class="loading-overlay mt-2"><span class="spinner"></span> AI 正在批改...</div>';

    try {
      var data = await API.gradeQuiz({
        subject: this.currentSubject,
        topic: this.currentMode,
        question: this.questionsText.slice(0, 500),
        user_answer: answer,
        correct_answer: '',
      });

      var resultDiv2 = document.getElementById('grading-result');
      if (!resultDiv2) return;

      var resultClass = 'grading-wrong';
      if (data.is_correct) resultClass = 'grading-correct';
      else if (data.is_partial) resultClass = 'grading-partial';

      var statusText = data.is_correct ? '✅ 回答正确！' : (data.is_partial ? '⚠️ 部分正确' : '❌ 回答有误');
      var errorTag = data.error_id ? '<div class="mt-1"><span class="tag tag-red">错题已记录: ' + data.error_id + '</span></div>' : '';

      resultDiv2.innerHTML = `
        <div class="grading-result ${resultClass}">
          <div class="text-lg mb-1">${statusText}</div>
          <div class="markdown-content">${renderMarkdown(data.grading)}</div>
          ${errorTag}
        </div>`;

      if (!data.is_correct) {
        showToast('错题已自动入库 (' + data.error_id + ')', 'info');
      }
    } catch (e) {
      var resultDiv3 = document.getElementById('grading-result');
      if (resultDiv3) resultDiv3.innerHTML = '<div class="alert alert-error mt-2">批改失败: ' + e.message + '</div>';
    }
  },

  reset() {
    var setupPanel = document.getElementById('quiz-setup-panel');
    var quizPanel = document.getElementById('quiz-panel');
    if (setupPanel) setupPanel.classList.remove('hidden');
    if (quizPanel) quizPanel.classList.add('hidden');
    var content = document.getElementById('quiz-content');
    if (content) content.innerHTML = '';
  },
};
