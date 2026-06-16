/* 模型设置页面 — 核心：切换大模型 */

const SettingsPage = {
  providers: [],
  currentConfig: null,
  gen: 0,

  render() {
    return `
      <div class="page-header">
        <h1>⚙️ 模型设置</h1>
        <p>配置 AI 大模型连接，支持切换不同厂商的模型</p>
      </div>

      <div class="panel">
        <h2>🔌 模型连接配置</h2>
        <div id="settings-form">
          <div class="loading-overlay"><span class="spinner"></span> 加载配置中...</div>
        </div>
      </div>

      <div class="panel">
        <h2>📋 使用说明</h2>
        <table>
          <tr><th>提供商</th><th>需要填写</th><th>获取方式</th></tr>
          <tr><td><span class="tag tag-blue">Anthropic</span></td><td>API Key + Model</td><td>console.anthropic.com</td></tr>
          <tr><td><span class="tag tag-green">OpenAI</span></td><td>API Key + Model</td><td>platform.openai.com</td></tr>
          <tr><td><span class="tag tag-purple">DeepSeek</span></td><td>API Key + Model</td><td>platform.deepseek.com</td></tr>
          <tr><td><span class="tag tag-amber">自定义</span></td><td>API Key + Base URL + Model</td><td>任意 OpenAI 兼容接口</td></tr>
        </table>
      </div>`;
  },

  init(gen, pageName) {
    this.gen = gen;
    this.loadConfig();
  },

  async loadConfig() {
    try {
      var results = await Promise.all([API.getConfig(), API.getProviders()]);
      var config = results[0];
      var providers = results[1];
      this.providers = providers;
      this.currentConfig = config;
      this.renderForm();
    } catch (e) {
      var container = document.getElementById('settings-form');
      if (container) container.innerHTML = '<div class="alert alert-error">加载配置失败: ' + e.message + '</div>';
    }
  },

  renderForm() {
    var container = document.getElementById('settings-form');
    if (!container) return;
    var c = this.currentConfig;

    var providerOptions = '';
    for (var i = 0; i < this.providers.length; i++) {
      var p = this.providers[i];
      providerOptions += '<option value="' + p.id + '"' + (c.provider === p.id ? ' selected' : '') + '>' + p.name + '</option>';
    }

    var selected = null;
    for (var j = 0; j < this.providers.length; j++) {
      if (this.providers[j].id === c.provider) { selected = this.providers[j]; break; }
    }
    var showBaseUrl = (selected && selected.needs_base_url) || c.provider === 'custom';

    var tempVal = (c.parameters && c.parameters.temperature) || 0.7;
    var maxTokVal = (c.parameters && c.parameters.max_tokens) || 4096;
    // 不预填API Key，确保每个用户自己填写（安全考虑）
    var keyHint = c.api_key_masked ? '（已配置 ' + c.api_key_masked + '，如需更换请重新输入）' : '（请填入你的 API Key）';

    container.innerHTML = `
      <div class="form-group">
        <label>AI 提供商</label>
        <select class="form-select" id="cfg-provider" onchange="SettingsPage.onProviderChange()">
          ${providerOptions}
        </select>
      </div>

      <div class="form-group" id="cfg-baseurl-group" style="${showBaseUrl ? '' : 'display:none'}">
        <label>Base URL (API 地址)</label>
        <input class="form-input" id="cfg-baseurl" value="${c.base_url || ''}"
               placeholder="例如: https://api.openai.com/v1">
        <div class="form-hint">OpenAI 兼容接口的地址。标准厂商无需填写。</div>
      </div>

      <div class="form-group">
        <label>模型名称</label>
        <input class="form-input" id="cfg-model" value="${c.model || ''}"
               placeholder="例如: gpt-4o, claude-sonnet-4-20250514, deepseek-chat">
        <div class="form-hint">填写模型的完整名称或 ID</div>
      </div>

      <div class="form-group">
        <label>API Key</label>
        <input class="form-input" type="password" id="cfg-apikey" value=""
               placeholder="sk-...">
        <div class="form-hint">${keyHint} 密钥仅存储在本地服务器，不会上传到任何第三方</div>
      </div>

      <div class="form-row mt-2">
        <div class="form-group">
          <label>Temperature</label>
          <input class="form-input" type="number" id="cfg-temp" value="${tempVal}"
                 min="0" max="2" step="0.1">
        </div>
        <div class="form-group">
          <label>Max Tokens</label>
          <input class="form-input" type="number" id="cfg-maxtokens" value="${maxTokVal}"
                 min="100" max="128000" step="100">
        </div>
      </div>

      <div class="flex-gap mt-2">
        <button class="btn btn-primary" onclick="SettingsPage.save()">💾 保存配置</button>
        <button class="btn" onclick="SettingsPage.test()" id="btn-test">🔍 测试连接</button>
        <span id="test-result" style="font-size:0.9rem"></span>
      </div>`;
  },

  onProviderChange() {
    var providerEl = document.getElementById('cfg-provider');
    if (!providerEl) return;
    var providerId = providerEl.value;
    var provider = null;
    for (var i = 0; i < SettingsPage.providers.length; i++) {
      if (SettingsPage.providers[i].id === providerId) { provider = SettingsPage.providers[i]; break; }
    }

    var baseUrlGroup = document.getElementById('cfg-baseurl-group');
    var modelInput = document.getElementById('cfg-model');

    if (provider) {
      if (baseUrlGroup) baseUrlGroup.style.display = provider.needs_base_url ? '' : 'none';
      if (provider.default_base_url) {
        var baseUrlEl = document.getElementById('cfg-baseurl');
        if (baseUrlEl && !baseUrlEl.value) baseUrlEl.value = provider.default_base_url;
      }
      if (provider.default_model && modelInput) {
        modelInput.value = provider.default_model;
        modelInput.placeholder = '例如: ' + provider.default_model;
      }
    }
  },

  async save() {
    var providerEl = document.getElementById('cfg-provider');
    var modelEl = document.getElementById('cfg-model');
    var apiKeyEl = document.getElementById('cfg-apikey');
    var baseUrlEl = document.getElementById('cfg-baseurl');
    var tempEl = document.getElementById('cfg-temp');
    var maxTokEl = document.getElementById('cfg-maxtokens');

    if (!providerEl || !modelEl || !apiKeyEl) return;

    var newKey = apiKeyEl.value.trim();

    // 如果没填新Key但之前已配置过，保留旧Key（只改其他设置不需要重输Key）
    if (!newKey && this.currentConfig && this.currentConfig.api_key_masked) {
      newKey = '__KEEP_EXISTING__';
    }
    if (!newKey) { showToast('请填写 API Key', 'warning'); return; }
    if (!modelEl.value) { showToast('请填写模型名称', 'warning'); return; }

    var data = {
      provider: providerEl.value,
      model: modelEl.value,
      api_key: newKey,
      base_url: baseUrlEl ? baseUrlEl.value : '',
      parameters: {
        temperature: tempEl ? (parseFloat(tempEl.value) || 0.7) : 0.7,
        max_tokens: maxTokEl ? (parseInt(maxTokEl.value) || 4096) : 4096,
      },
    };

    try {
      await API.updateConfig(data);
      showToast('✅ 配置已保存', 'success');
      // 更新本地缓存（不存真实key，用masked替代）
      if (newKey !== '__KEEP_EXISTING__') {
        this.currentConfig.api_key_masked = newKey.slice(0, 4) + '****' + newKey.slice(-4);
      }
    } catch (e) {
      showToast('保存失败: ' + e.message, 'error');
    }
  },

  async test() {
    var btn = document.getElementById('btn-test');
    var result = document.getElementById('test-result');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ 测试中...'; }
    if (result) result.innerHTML = '';

    try {
      await this.save();
      var res = await API.testConfig();
      if (result) result.innerHTML = '<span class="text-green">✅ ' + res.message + '</span>';
      showToast('连接测试成功！', 'success');
    } catch (e) {
      if (result) result.innerHTML = '<span class="text-red">❌ ' + e.message + '</span>';
      showToast('连接失败: ' + e.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '🔍 测试连接'; }
    }
  },
};
