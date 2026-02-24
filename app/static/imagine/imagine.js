(() => {
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const clearBtn = document.getElementById('clearBtn');
  const promptInput = document.getElementById('promptInput');
  const ratioSelect = document.getElementById('ratioSelect');
  const concurrentSelect = document.getElementById('concurrentSelect');
  const autoScrollToggle = document.getElementById('autoScrollToggle');
  const autoDownloadToggle = document.getElementById('autoDownloadToggle');
  const selectFolderBtn = document.getElementById('selectFolderBtn');
  const folderPath = document.getElementById('folderPath');
  const statusText = document.getElementById('statusText');
  const countValue = document.getElementById('countValue');
  const activeValue = document.getElementById('activeValue');
  const latencyValue = document.getElementById('latencyValue');
  const modeButtons = document.querySelectorAll('.mode-btn');
  const waterfall = document.getElementById('waterfall');
  const emptyState = document.getElementById('emptyState');
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  const closeLightbox = document.getElementById('closeLightbox');
  const waterfallShowPreview = document.getElementById('waterfallShowPreview');

  let wsConnections = [];
  let sseConnections = [];
  let imageCount = 0;
  let totalLatency = 0;
  let latencyCount = 0;
  let lastRunId = '';
  let isRunning = false;
  let connectionMode = 'ws';
  let modePreference = 'auto';
  const MODE_STORAGE_KEY = 'imagine_mode';
  let pendingFallbackTimer = null;
  let currentTaskIds = [];
  let directoryHandle = null;
  let useFileSystemAPI = false;
  let isSelectionMode = false;
  let selectedImages = new Set();

  // === Edit mode state ===
  let imagineMode = 'generate'; // 'generate' or 'edit'
  let editImageFile = null; // raw File object for upload
  let editOriginalImageSrc = null; // 存储原图 base64 用于对比
  let editOriginalFileName = null; // 存储原始文件名（不含扩展名）
  let editImageCounter = 0; // 编辑图片计数器
  const imagineModeBtns = document.querySelectorAll('.imagine-mode-btn');
  const editImageUpload = document.getElementById('editImageUpload');
  const editUploadArea = document.getElementById('editUploadArea');
  const editFileInput = document.getElementById('editFileInput');
  const editUploadPlaceholder = document.getElementById('editUploadPlaceholder');
  const editPreviewContainer = document.getElementById('editPreviewContainer');
  const editPreviewImg = document.getElementById('editPreviewImg');
  const editRemoveBtn = document.getElementById('editRemoveBtn');

  // === Imagine Mode Toggle ===
  function switchImagineMode(mode) {
    imagineMode = mode;
    imagineModeBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.imagineMode === mode));
    if (mode === 'edit') {
      if (editImageUpload) editImageUpload.classList.remove('hidden');
    } else {
      if (editImageUpload) editImageUpload.classList.add('hidden');
    }
  }

  imagineModeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.imagineMode;
      if (mode) switchImagineMode(mode);
    });
  });

  // === Edit Image Upload ===
  function handleEditFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      toast('请选择图片文件', 'error');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast('图片不能超过 50MB', 'error');
      return;
    }
    editImageFile = file;
    // 提取原始文件名（不含扩展名）
    const fileName = file.name || 'image';
    const lastDot = fileName.lastIndexOf('.');
    editOriginalFileName = lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
    editImageCounter = 0; // 重置计数器
    const reader = new FileReader();
    reader.onload = (e) => {
      if (editPreviewImg) editPreviewImg.src = e.target.result;
      // 保存原图用于对比功能
      editOriginalImageSrc = e.target.result;
      if (editUploadPlaceholder) editUploadPlaceholder.classList.add('hidden');
      if (editPreviewContainer) editPreviewContainer.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }

  function removeEditImage() {
    editImageFile = null;
    editOriginalImageSrc = null; // 清除原图引用
    editOriginalFileName = null; // 清除原始文件名
    editImageCounter = 0; // 重置计数器
    if (editFileInput) editFileInput.value = '';
    if (editPreviewImg) editPreviewImg.src = '';
    if (editPreviewContainer) editPreviewContainer.classList.add('hidden');
    if (editUploadPlaceholder) editUploadPlaceholder.classList.remove('hidden');
  }

  if (editUploadArea) {
    editUploadArea.addEventListener('click', (e) => {
      if (e.target.closest('#editRemoveBtn')) return;
      if (editFileInput) editFileInput.click();
    });
    editUploadArea.addEventListener('dragover', (e) => { e.preventDefault(); editUploadArea.classList.add('dragover'); });
    editUploadArea.addEventListener('dragleave', () => { editUploadArea.classList.remove('dragover'); });
    editUploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      editUploadArea.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file) handleEditFile(file);
    });
  }
  if (editFileInput) {
    editFileInput.addEventListener('change', () => {
      const file = editFileInput.files[0];
      if (file) handleEditFile(file);
    });
  }
  if (editRemoveBtn) {
    editRemoveBtn.addEventListener('click', (e) => { e.stopPropagation(); removeEditImage(); });
  }

  function toast(message, type) {
    if (typeof showToast === 'function') {
      showToast(message, type);
    }
  }

  function setStatus(state, text) {
    if (!statusText) return;
    statusText.textContent = text;
    statusText.classList.remove('connected', 'connecting', 'error');
    if (state) {
      statusText.classList.add(state);
    }
  }

  function setButtons(connected) {
    if (!startBtn || !stopBtn) return;
    if (connected) {
      startBtn.classList.add('hidden');
      stopBtn.classList.remove('hidden');
    } else {
      startBtn.classList.remove('hidden');
      stopBtn.classList.add('hidden');
      startBtn.disabled = false;
    }
  }

  function updateCount(value) {
    if (countValue) {
      countValue.textContent = String(value);
    }
  }

  function updateActive() {
    if (!activeValue) return;
    if (connectionMode === 'sse') {
      const active = sseConnections.filter(es => es && es.readyState === EventSource.OPEN).length;
      activeValue.textContent = String(active);
      return;
    }
    const active = wsConnections.filter(ws => ws && ws.readyState === WebSocket.OPEN).length;
    activeValue.textContent = String(active);
  }

  function setModePreference(mode, persist = true) {
    if (!['auto', 'ws', 'sse'].includes(mode)) return;
    modePreference = mode;
    modeButtons.forEach(btn => {
      if (btn.dataset.mode === mode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    if (persist) {
      try {
        localStorage.setItem(MODE_STORAGE_KEY, mode);
      } catch (e) {
        // ignore
      }
    }
    updateModeValue();
  }

  function updateModeValue() {}


  function updateLatency(value) {
    if (value) {
      totalLatency += value;
      latencyCount += 1;
      const avg = Math.round(totalLatency / latencyCount);
      if (latencyValue) {
        latencyValue.textContent = `${avg} ms`;
      }
    } else {
      if (latencyValue) {
        latencyValue.textContent = '-';
      }
    }
  }

  function updateError(value) {}

  function inferMime(base64) {
    if (!base64) return 'image/jpeg';
    if (base64.startsWith('iVBOR')) return 'image/png';
    if (base64.startsWith('/9j/')) return 'image/jpeg';
    if (base64.startsWith('R0lGOD')) return 'image/gif';
    return 'image/jpeg';
  }

  function dataUrlToBlob(dataUrl) {
    const parts = (dataUrl || '').split(',');
    if (parts.length < 2) return null;
    const header = parts[0];
    const b64 = parts.slice(1).join(',');
    const match = header.match(/data:(.*?);base64/);
    const mime = match ? match[1] : 'application/octet-stream';
    try {
      const byteString = atob(b64);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      return new Blob([ab], { type: mime });
    } catch (e) {
      return null;
    }
  }

  async function createImagineTask(prompt, ratio, apiKey) {
    const res = await fetch('/api/v1/admin/imagine/start', {
      method: 'POST',
      headers: {
        ...buildAuthHeaders(apiKey),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ prompt, aspect_ratio: ratio })
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Failed to create task');
    }
    const data = await res.json();
    return data && data.task_id ? String(data.task_id) : '';
  }

  async function createImagineTasks(prompt, ratio, concurrent, apiKey) {
    const tasks = [];
    for (let i = 0; i < concurrent; i++) {
      const taskId = await createImagineTask(prompt, ratio, apiKey);
      if (!taskId) {
        throw new Error('Missing task id');
      }
      tasks.push(taskId);
    }
    return tasks;
  }

  async function stopImagineTasks(taskIds, apiKey) {
    if (!taskIds || taskIds.length === 0) return;
    try {
      await fetch('/api/v1/admin/imagine/stop', {
        method: 'POST',
        headers: {
          ...buildAuthHeaders(apiKey),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ task_ids: taskIds })
      });
    } catch (e) {
      // ignore
    }
  }

  async function saveToFileSystem(base64, filename) {
    console.log('[SaveFS] 尝试保存到自定义文件夹:', filename, 'directoryHandle:', directoryHandle?.name);
    try {
      if (!directoryHandle) {
        console.log('[SaveFS] 无 directoryHandle, 跳过');
        return false;
      }
      
      const mime = inferMime(base64);
      const ext = mime === 'image/png' ? 'png' : 'jpg';
      const finalFilename = filename.endsWith(`.${ext}`) ? filename : `${filename}.${ext}`;
      
      const fileHandle = await directoryHandle.getFileHandle(finalFilename, { create: true });
      const writable = await fileHandle.createWritable();
      
      // Convert base64 to blob
      const byteString = atob(base64);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mime });
      
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (e) {
      console.error('File System API save failed:', e);
      return false;
    }
  }

  function downloadImage(base64, filename) {
    console.log('[Download] 浏览器默认下载:', filename, 'base64 length:', base64.length);
    const mime = inferMime(base64);
    const dataUrl = `data:${mime};base64,${base64}`;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    console.log('[Download] <a> click 已触发, 文件名:', filename);
  }

  function appendImage(base64, meta) {
    if (!waterfall) return;
    if (emptyState) {
      emptyState.style.display = 'none';
    }

    const item = document.createElement('div');
    item.className = 'waterfall-item';

    const checkbox = document.createElement('div');
    checkbox.className = 'image-checkbox';

    const img = document.createElement('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = meta && meta.sequence ? `image-${meta.sequence}` : 'image';
    const mime = inferMime(base64);
    const dataUrl = `data:${mime};base64,${base64}`;
    img.src = dataUrl;

    const metaBar = document.createElement('div');
    metaBar.className = 'waterfall-meta';
    const left = document.createElement('div');
    left.textContent = meta && meta.sequence ? `#${meta.sequence}` : '#';
    const right = document.createElement('span');
    if (meta && meta.elapsed_ms) {
      right.textContent = `${meta.elapsed_ms}ms`;
    } else {
      right.textContent = '';
    }

    metaBar.appendChild(left);
    metaBar.appendChild(right);

    item.appendChild(checkbox);
    item.appendChild(img);
    item.appendChild(metaBar);

    // 生成下载文件名
    let downloadFileName;
    const ext = mime === 'image/png' ? 'png' : 'jpg';
    if (meta && meta.downloadFileName) {
      // 优先使用传入的文件名（批量编辑模式）
      downloadFileName = meta.downloadFileName;
    } else if (imagineMode === 'edit' && editOriginalFileName) {
      // 单张编辑模式：使用原文件名 + _edit 后缀
      editImageCounter++;
      const suffix = editImageCounter === 1 ? '_edit' : `_edit${editImageCounter}`;
      downloadFileName = `${editOriginalFileName}${suffix}.${ext}`;
    } else {
      // 生成模式：使用 imagine_timestamp_seq 格式
      const timestamp = Date.now();
      const seq = meta && meta.sequence ? meta.sequence : imageCount;
      downloadFileName = `imagine_${timestamp}_${seq}.${ext}`;
    }

    // 添加下载按钮（右上角）
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'waterfall-download-btn';
    downloadBtn.title = '下载图片';
    downloadBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
    `;
    downloadBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      console.log('[DownloadBtn] 点击下载, useFileSystemAPI:', useFileSystemAPI, 'directoryHandle:', directoryHandle?.name, 'fileName:', downloadFileName);
      if (useFileSystemAPI && directoryHandle) {
        const saved = await saveToFileSystem(base64, downloadFileName);
        if (saved) {
          toast(`已保存到 ${directoryHandle.name}/${downloadFileName}`, 'success');
        } else {
          downloadImage(base64, downloadFileName);
          toast(`已下载到浏览器默认位置: ${downloadFileName}`, 'success');
        }
      } else {
        downloadImage(base64, downloadFileName);
        toast(`已下载到浏览器默认位置: ${downloadFileName}`, 'success');
      }
    });
    item.appendChild(downloadBtn);
    // 存储下载文件名
    item.dataset.downloadFileName = downloadFileName;

    // 添加对比按钮（如果有原图引用或文件索引）
    const originalImageSrc = (meta && meta.originalImage) || (imagineMode === 'edit' && editOriginalImageSrc);
    const originalFileIndex = meta && meta.originalFileIndex;
    const hasOriginalRef = originalImageSrc || (typeof originalFileIndex === 'number');
    
    if (hasOriginalRef) {
      const compareBtn = document.createElement('button');
      compareBtn.className = 'waterfall-compare-btn visible';
      compareBtn.title = '对比原图';
      compareBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="8" height="18" rx="1"></rect>
          <rect x="13" y="3" width="8" height="18" rx="1"></rect>
        </svg>
      `;
      compareBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openCompareView(dataUrl);
      });
      item.appendChild(compareBtn);
      // 存储原图引用或文件索引到 item 上
      if (originalImageSrc) {
        item.dataset.originalImage = originalImageSrc;
      }
      if (typeof originalFileIndex === 'number') {
        item.dataset.originalFileIndex = originalFileIndex;
      }
    }

    const prompt = (meta && meta.prompt) ? String(meta.prompt) : (promptInput ? promptInput.value.trim() : '');
    item.dataset.imageUrl = dataUrl;
    item.dataset.prompt = prompt || 'image';
    if (isSelectionMode) {
      item.classList.add('selection-mode');
    }
    
    waterfall.appendChild(item);

    if (autoScrollToggle && autoScrollToggle.checked) {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }

    if (autoDownloadToggle && autoDownloadToggle.checked) {
      // 使用已生成的下载文件名
      if (useFileSystemAPI && directoryHandle) {
        saveToFileSystem(base64, downloadFileName).catch(() => {
          downloadImage(base64, downloadFileName);
        });
      } else {
        downloadImage(base64, downloadFileName);
      }
    }
  }

  function handleMessage(raw) {
    let data = null;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      return;
    }
    if (!data || typeof data !== 'object') return;

    if (data.type === 'image') {
      imageCount += 1;
      updateCount(imageCount);
      updateLatency(data.elapsed_ms);
      updateError('');
      appendImage(data.b64_json, data);
    } else if (data.type === 'status') {
      if (data.status === 'running') {
        setStatus('connected', '生成中');
        lastRunId = data.run_id || '';
      } else if (data.status === 'stopped') {
        if (data.run_id && lastRunId && data.run_id !== lastRunId) {
          return;
        }
        setStatus('', '已停止');
      }
    } else if (data.type === 'error') {
      const message = data.message || '生成失败';
      updateError(message);
      toast(message, 'error');
    }
  }

  function stopAllConnections() {
    wsConnections.forEach(ws => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: 'stop' }));
        } catch (e) {
          // ignore
        }
      }
      try {
        ws.close(1000, 'client stop');
      } catch (e) {
        // ignore
      }
    });
    wsConnections = [];

    sseConnections.forEach(es => {
      try {
        es.close();
      } catch (e) {
        // ignore
      }
    });
    sseConnections = [];
    updateActive();
    updateModeValue();
  }

  function buildSseUrl(taskId, index) {
    const httpProtocol = window.location.protocol === 'https:' ? 'https' : 'http';
    const base = `${httpProtocol}://${window.location.host}/api/v1/admin/imagine/sse`;
    const params = new URLSearchParams();
    params.set('task_id', taskId);
    params.set('t', String(Date.now()));
    if (typeof index === 'number') {
      params.set('conn', String(index));
    }
    return `${base}?${params.toString()}`;
  }

  function startSSE(taskIds) {
    connectionMode = 'sse';
    stopAllConnections();
    updateModeValue();

    setStatus('connected', '生成中 (SSE)');
    setButtons(true);
    toast(`已启动 ${taskIds.length} 个并发任务 (SSE)`, 'success');

    for (let i = 0; i < taskIds.length; i++) {
      const url = buildSseUrl(taskIds[i], i);
      const es = new EventSource(url);

      es.onopen = () => {
        updateActive();
      };

      es.onmessage = (event) => {
        handleMessage(event.data);
      };

      es.onerror = () => {
        updateActive();
        const remaining = sseConnections.filter(e => e && e.readyState === EventSource.OPEN).length;
        if (remaining === 0) {
          setStatus('error', '连接错误');
          setButtons(false);
          isRunning = false;
          startBtn.disabled = false;
          updateModeValue();
        }
      };

      sseConnections.push(es);
    }
  }

  async function startConnection() {
    const prompt = promptInput ? promptInput.value.trim() : '';
    if (!prompt) {
      toast('请输入提示词', 'error');
      return;
    }

    const apiKey = await ensureApiKey();
    if (apiKey === null) {
      toast('请先登录后台', 'error');
      return;
    }

    const concurrent = concurrentSelect ? parseInt(concurrentSelect.value, 10) : 1;
    const ratio = ratioSelect ? ratioSelect.value : '2:3';
    
    if (isRunning) {
      toast('已在运行中', 'warning');
      return;
    }

    isRunning = true;
    setStatus('connecting', '连接中');
    startBtn.disabled = true;

    if (pendingFallbackTimer) {
      clearTimeout(pendingFallbackTimer);
      pendingFallbackTimer = null;
    }

    let taskIds = [];
    try {
      taskIds = await createImagineTasks(prompt, ratio, concurrent, apiKey);
    } catch (e) {
      setStatus('error', '创建任务失败');
      startBtn.disabled = false;
      isRunning = false;
      return;
    }
    currentTaskIds = taskIds;

    if (modePreference === 'sse') {
      startSSE(taskIds);
      return;
    }

    connectionMode = 'ws';
    stopAllConnections();
    updateModeValue();

    let opened = 0;
    let fallbackDone = false;
    let fallbackTimer = null;
    if (modePreference === 'auto') {
      fallbackTimer = setTimeout(() => {
        if (!fallbackDone && opened === 0) {
          fallbackDone = true;
          startSSE(taskIds);
        }
      }, 1500);
    }
    pendingFallbackTimer = fallbackTimer;

    wsConnections = [];

    for (let i = 0; i < taskIds.length; i++) {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const wsUrl = `${protocol}://${window.location.host}/api/v1/admin/imagine/ws?task_id=${encodeURIComponent(taskIds[i])}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        opened += 1;
        updateActive();
        if (i === 0) {
          setStatus('connected', '生成中');
          setButtons(true);
          toast(`已启动 ${concurrent} 个并发任务`, 'success');
        }
        sendStart(prompt, ws);
      };

      ws.onmessage = (event) => {
        handleMessage(event.data);
      };

      ws.onclose = () => {
        updateActive();
        if (connectionMode !== 'ws') {
          return;
        }
        const remaining = wsConnections.filter(w => w && w.readyState === WebSocket.OPEN).length;
        if (remaining === 0 && !fallbackDone) {
          setStatus('', '未连接');
          setButtons(false);
          isRunning = false;
          updateModeValue();
        }
      };

      ws.onerror = () => {
        updateActive();
        if (modePreference === 'auto' && opened === 0 && !fallbackDone) {
          fallbackDone = true;
          if (fallbackTimer) {
            clearTimeout(fallbackTimer);
          }
          startSSE(taskIds);
          return;
        }
        if (i === 0 && wsConnections.filter(w => w && w.readyState === WebSocket.OPEN).length === 0) {
          setStatus('error', '连接错误');
          startBtn.disabled = false;
          isRunning = false;
          updateModeValue();
        }
      };

      wsConnections.push(ws);
    }
  }

  function sendStart(promptOverride, targetWs) {
    const ws = targetWs || wsConnections[0];
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const prompt = promptOverride || (promptInput ? promptInput.value.trim() : '');
    const ratio = ratioSelect ? ratioSelect.value : '2:3';
    const payload = {
      type: 'start',
      prompt,
      aspect_ratio: ratio
    };
    ws.send(JSON.stringify(payload));
    updateError('');
  }

  async function stopConnection() {
    if (pendingFallbackTimer) {
      clearTimeout(pendingFallbackTimer);
      pendingFallbackTimer = null;
    }

    const apiKey = await ensureApiKey();
    if (apiKey && currentTaskIds.length > 0) {
      await stopImagineTasks(currentTaskIds, apiKey);
    }

    stopAllConnections();
    currentTaskIds = [];
    isRunning = false;
    updateActive();
    updateModeValue();
    setButtons(false);
    setStatus('', '未连接');
  }

  // === Edit Mode: call /v1/images/edits ===
  async function startEditMode() {
    const prompt = promptInput ? promptInput.value.trim() : '';
    if (!prompt) {
      toast('请输入提示词', 'error');
      return;
    }
    if (!editImageFile) {
      toast('请上传参考图片', 'error');
      return;
    }

    const apiKey = await ensureApiKey();
    if (apiKey === null) {
      toast('请先登录后台', 'error');
      return;
    }

    if (isRunning) {
      toast('已在运行中', 'warning');
      return;
    }

    isRunning = true;
    setStatus('connecting', '编辑中...');
    setButtons(true);

    const startTime = Date.now();
    const formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('image', editImageFile);
    formData.append('model', 'grok-imagine-1.0-edit');
    formData.append('n', '1');
    formData.append('response_format', 'b64_json');
    formData.append('size', 'original'); // 保持原图尺寸

    try {
      const res = await fetch('/v1/images/edits', {
        method: 'POST',
        headers: buildAuthHeaders(apiKey),
        body: formData,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const elapsed = Date.now() - startTime;

      if (data.data && data.data.length > 0) {
        data.data.forEach((item, idx) => {
          const b64 = item.b64_json;
          if (b64) {
            imageCount += 1;
            updateCount(imageCount);
            updateLatency(elapsed);
            appendImage(b64, { sequence: imageCount, elapsed_ms: elapsed, prompt: prompt });
          }
        });
        setStatus('connected', '编辑完成');
        toast('图片编辑完成', 'success');
      } else {
        setStatus('error', '无结果');
        toast('未获取到编辑结果', 'error');
      }
    } catch (e) {
      setStatus('error', '编辑失败');
      toast('编辑失败: ' + e.message, 'error');
    } finally {
      isRunning = false;
      setButtons(false);
    }
  }

  function clearImages() {
    if (waterfall) {
      waterfall.innerHTML = '';
    }
    imageCount = 0;
    totalLatency = 0;
    latencyCount = 0;
    updateCount(imageCount);
    updateLatency('');
    updateError('');
    if (emptyState) {
      emptyState.style.display = 'block';
    }
  }

  // startBtn 事件监听器移到批量编辑部分统一处理

  if (stopBtn) {
    stopBtn.addEventListener('click', () => {
      stopConnection();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => clearImages());
  }

  if (promptInput) {
    promptInput.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        if (imagineMode === 'batch') {
          processBatch();
        } else if (imagineMode === 'edit') {
          startEditMode();
        } else {
          startConnection();
        }
      }
    });
  }

  if (ratioSelect) {
    ratioSelect.addEventListener('change', () => {
      if (isRunning) {
        if (connectionMode === 'sse') {
          stopConnection().then(() => {
            setTimeout(() => startConnection(), 50);
          });
          return;
        }
        wsConnections.forEach(ws => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            sendStart(null, ws);
          }
        });
      }
    });
  }

  if (modeButtons.length > 0) {
    const saved = (() => {
      try {
        return localStorage.getItem(MODE_STORAGE_KEY);
      } catch (e) {
        return null;
      }
    })();
    if (saved) {
      setModePreference(saved, false);
    } else {
      setModePreference('auto', false);
    }

    modeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        if (!mode) return;
        setModePreference(mode);
        if (isRunning) {
          stopConnection().then(() => {
            setTimeout(() => startConnection(), 50);
          });
        }
      });
    });
  }

  // File System API support check
  const lastFolderBtn = document.getElementById('lastFolderBtn');
  const lastFolderName = document.getElementById('lastFolderName');
  const LAST_FOLDER_KEY = 'imagine_last_folder';

  // 更新目录选择 UI
  function updateFolderUI(folderName, isActive) {
    if (folderPath) {
      folderPath.textContent = folderName || '浏览器默认位置';
    }
    if (selectFolderBtn) {
      selectFolderBtn.style.color = isActive ? '#059669' : '';
    }
    // 保存到 localStorage
    if (folderName) {
      try {
        localStorage.setItem(LAST_FOLDER_KEY, folderName);
      } catch (e) {}
    }
    // 更新上次目录按钮
    updateLastFolderBtn();
  }

  // 更新上次目录按钮显示
  function updateLastFolderBtn() {
    if (!lastFolderBtn || !lastFolderName) return;
    
    try {
      const lastFolder = localStorage.getItem(LAST_FOLDER_KEY);
      if (lastFolder && (!directoryHandle || directoryHandle.name !== lastFolder)) {
        lastFolderName.textContent = lastFolder;
        lastFolderBtn.classList.remove('hidden');
      } else {
        lastFolderBtn.classList.add('hidden');
      }
    } catch (e) {
      lastFolderBtn.classList.add('hidden');
    }
  }

  // 选择目录的公共函数
  async function selectDirectory() {
    try {
      directoryHandle = await window.showDirectoryPicker({
        mode: 'readwrite'
      });
      useFileSystemAPI = true;
      updateFolderUI(directoryHandle.name, true);
      toast('已选择文件夹: ' + directoryHandle.name, 'success');
      return true;
    } catch (e) {
      if (e.name !== 'AbortError') {
        toast('选择文件夹失败', 'error');
      }
      return false;
    }
  }

  if ('showDirectoryPicker' in window) {
    if (selectFolderBtn) {
      selectFolderBtn.disabled = false;
      selectFolderBtn.addEventListener('click', selectDirectory);
    }

    // 上次目录按钮
    if (lastFolderBtn) {
      lastFolderBtn.addEventListener('click', selectDirectory);
    }

    // 初始化显示上次目录
    updateLastFolderBtn();
  }

  // Enable/disable folder selection based on auto-download
  if (autoDownloadToggle && selectFolderBtn) {
    autoDownloadToggle.addEventListener('change', () => {
      if (autoDownloadToggle.checked && 'showDirectoryPicker' in window) {
        selectFolderBtn.disabled = false;
      } else {
        selectFolderBtn.disabled = true;
      }
    });
  }

  // Collapsible cards - 点击"连接状态"标题控制所有卡片
  const statusToggle = document.getElementById('statusToggle');

  if (statusToggle) {
    statusToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const cards = document.querySelectorAll('.imagine-card-collapsible');
      const allCollapsed = Array.from(cards).every(card => card.classList.contains('collapsed'));
      
      cards.forEach(card => {
        if (allCollapsed) {
          card.classList.remove('collapsed');
        } else {
          card.classList.add('collapsed');
        }
      });
    });
  }

  // Batch download functionality
  const batchDownloadBtn = document.getElementById('batchDownloadBtn');
  const selectionToolbar = document.getElementById('selectionToolbar');
  const toggleSelectAllBtn = document.getElementById('toggleSelectAllBtn');
  const downloadSelectedBtn = document.getElementById('downloadSelectedBtn');
  
  function enterSelectionMode() {
    isSelectionMode = true;
    selectedImages.clear();
    selectionToolbar.classList.remove('hidden');
    
    const items = document.querySelectorAll('.waterfall-item');
    items.forEach(item => {
      item.classList.add('selection-mode');
    });
    
    updateSelectedCount();
  }
  
  function exitSelectionMode() {
    isSelectionMode = false;
    selectedImages.clear();
    selectionToolbar.classList.add('hidden');
    
    const items = document.querySelectorAll('.waterfall-item');
    items.forEach(item => {
      item.classList.remove('selection-mode', 'selected');
    });
  }
  
  function toggleSelectionMode() {
    if (isSelectionMode) {
      exitSelectionMode();
    } else {
      enterSelectionMode();
    }
  }
  
  function toggleImageSelection(item) {
    if (!isSelectionMode) return;
    
    if (item.classList.contains('selected')) {
      item.classList.remove('selected');
      selectedImages.delete(item);
    } else {
      item.classList.add('selected');
      selectedImages.add(item);
    }
    
    updateSelectedCount();
  }
  
  function updateSelectedCount() {
    const countSpan = document.getElementById('selectedCount');
    if (countSpan) {
      countSpan.textContent = selectedImages.size;
    }
    if (downloadSelectedBtn) {
      downloadSelectedBtn.disabled = selectedImages.size === 0;
    }
    
    // Update toggle select all button text
    if (toggleSelectAllBtn) {
      const items = document.querySelectorAll('.waterfall-item');
      const allSelected = items.length > 0 && selectedImages.size === items.length;
      toggleSelectAllBtn.textContent = allSelected ? '取消全选' : '全选';
    }
  }
  
  function toggleSelectAll() {
    const items = document.querySelectorAll('.waterfall-item');
    const allSelected = items.length > 0 && selectedImages.size === items.length;
    
    if (allSelected) {
      // Deselect all
      items.forEach(item => {
        item.classList.remove('selected');
      });
      selectedImages.clear();
    } else {
      // Select all
      items.forEach(item => {
        item.classList.add('selected');
        selectedImages.add(item);
      });
    }
    
    updateSelectedCount();
  }
  
  async function downloadSelectedImages() {
    if (selectedImages.size === 0) {
      toast('请先选择要下载的图片', 'warning');
      return;
    }
    
    if (typeof JSZip === 'undefined') {
      toast('JSZip 库加载失败，请刷新页面重试', 'error');
      return;
    }
    
    toast(`正在打包 ${selectedImages.size} 张图片...`, 'info');
    downloadSelectedBtn.disabled = true;
    downloadSelectedBtn.textContent = '打包中...';
    
    const zip = new JSZip();
    const imgFolder = zip.folder('images');
    let processed = 0;
    
    try {
      for (const item of selectedImages) {
        const url = item.dataset.imageUrl;
        const prompt = item.dataset.prompt || 'image';
        
        try {
          let blob = null;
          if (url && url.startsWith('data:')) {
            blob = dataUrlToBlob(url);
          } else if (url) {
            const response = await fetch(url);
            blob = await response.blob();
          }
          if (!blob) {
            throw new Error('empty blob');
          }
          const filename = `${prompt.substring(0, 30).replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}_${processed + 1}.png`;
          imgFolder.file(filename, blob);
          processed++;
          
          // Update progress
          downloadSelectedBtn.innerHTML = `打包中... (${processed}/${selectedImages.size})`;
        } catch (error) {
          console.error('Failed to fetch image:', error);
        }
      }
      
      if (processed === 0) {
        toast('没有成功获取任何图片', 'error');
        return;
      }
      
      // Generate zip file
      downloadSelectedBtn.textContent = '生成压缩包...';
      const content = await zip.generateAsync({ type: 'blob' });
      
      // Download zip
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `imagine_${new Date().toISOString().slice(0, 10)}_${Date.now()}.zip`;
      link.click();
      URL.revokeObjectURL(link.href);
      
      toast(`成功打包 ${processed} 张图片`, 'success');
      exitSelectionMode();
    } catch (error) {
      console.error('Download failed:', error);
      toast('打包失败，请重试', 'error');
    } finally {
    downloadSelectedBtn.disabled = false;
    downloadSelectedBtn.innerHTML = `下载 <span id="selectedCount" class="selected-count">${selectedImages.size}</span>`;
    }
  }
  
  if (batchDownloadBtn) {
    batchDownloadBtn.addEventListener('click', toggleSelectionMode);
  }
  
  if (toggleSelectAllBtn) {
    toggleSelectAllBtn.addEventListener('click', toggleSelectAll);
  }
  
  if (downloadSelectedBtn) {
    downloadSelectedBtn.addEventListener('click', downloadSelectedImages);
  }
  
  
  // Handle image/checkbox clicks in waterfall
  if (waterfall) {
    waterfall.addEventListener('click', (e) => {
      const item = e.target.closest('.waterfall-item');
      if (!item) return;
      
      if (isSelectionMode) {
        // In selection mode, clicking anywhere on the item toggles selection
        toggleImageSelection(item);
      } else {
        // In normal mode, only clicking the image opens lightbox
        if (e.target.closest('.waterfall-item img')) {
          const img = e.target.closest('.waterfall-item img');
          const images = getAllImages();
          const index = images.indexOf(img);
          
          if (index !== -1) {
            updateLightbox(index);
            lightbox.classList.add('active');
          }
        }
      }
    });
  }

  // Lightbox for image preview with navigation
  const lightboxPrev = document.getElementById('lightboxPrev');
  const lightboxNext = document.getElementById('lightboxNext');
  const lightboxCompareBtn = document.getElementById('lightboxCompareBtn');
  const lightboxCompareView = document.getElementById('lightboxCompareView');
  const compareOriginalImg = document.getElementById('compareOriginalImg');
  const compareEditedImg = document.getElementById('compareEditedImg');
  const compareOriginalName = document.getElementById('compareOriginalName');
  const compareEditedName = document.getElementById('compareEditedName');
  const compareFolderPath = document.getElementById('compareFolderPath');
  let currentImageIndex = -1;
  let isCompareMode = false;

  function getAllImages() {
    return Array.from(document.querySelectorAll('.waterfall-item img'));
  }

  function getAllWaterfallItems() {
    return Array.from(document.querySelectorAll('.waterfall-item'));
  }

  function updateLightbox(index) {
    const images = getAllImages();
    if (index < 0 || index >= images.length) return;

    currentImageIndex = index;
    lightboxImg.src = images[index].src;

    // 检查当前图片是否有原图（编辑模式产生的）
    const items = getAllWaterfallItems();
    const currentItem = items[index];
    const hasOriginal = currentItem && currentItem.dataset.originalImage;

    // 显示/隐藏对比按钮
    if (lightboxCompareBtn) {
      if (hasOriginal) {
        lightboxCompareBtn.classList.remove('hidden');
      } else {
        lightboxCompareBtn.classList.add('hidden');
        // 如果没有原图，退出对比模式
        if (isCompareMode) {
          exitCompareMode();
        }
      }
    }

    // 如果在对比模式下切换图片，更新对比视图
    if (isCompareMode && hasOriginal) {
      updateCompareView(currentItem.dataset.originalImage, images[index].src);
    }

    // Update navigation buttons state
    if (lightboxPrev) lightboxPrev.disabled = (index === 0);
    if (lightboxNext) lightboxNext.disabled = (index === images.length - 1);
  }

  function updateCompareView(originalSrc, editedSrc, originalName, editedName, folderPath) {
    if (compareOriginalImg) compareOriginalImg.src = originalSrc;
    if (compareEditedImg) compareEditedImg.src = editedSrc;
    if (compareOriginalName) compareOriginalName.textContent = originalName || '原图';
    if (compareEditedName) compareEditedName.textContent = editedName || '编辑后';
    if (compareFolderPath) {
      if (folderPath) {
        compareFolderPath.textContent = `📁 ${folderPath}`;
        compareFolderPath.style.display = '';
      } else {
        compareFolderPath.style.display = 'none';
      }
    }
  }

  // 从文件索引按需读取原图
  async function readOriginalImageFromFile(fileIndex) {
    if (fileIndex < 0 || fileIndex >= batchFiles.length) return null;
    const file = batchFiles[fileIndex];
    if (!file) return null;
    
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  async function enterCompareMode() {
    isCompareMode = true;
    const items = getAllWaterfallItems();
    const currentItem = items[currentImageIndex];

    if (!currentItem) return;

    // 获取原图来源：直接存储的 base64 或 文件索引
    let originalImageSrc = currentItem.dataset.originalImage;
    const originalFileIndex = currentItem.dataset.originalFileIndex;

    // 省内存模式：按需从文件读取
    if (!originalImageSrc && originalFileIndex !== undefined) {
      const idx = parseInt(originalFileIndex, 10);
      if (!isNaN(idx)) {
        // 显示加载状态
        if (compareOriginalImg) {
          compareOriginalImg.src = '';
          compareOriginalImg.alt = '加载中...';
        }
        originalImageSrc = await readOriginalImageFromFile(idx);
      }
    }

    if (originalImageSrc) {
      const images = getAllImages();
      
      // 获取文件名信息
      const downloadFileName = currentItem.dataset.downloadFileName || '编辑后';
      // 尝试获取原始文件名（从编辑后文件名推断）
      let originalName = '原图';
      if (downloadFileName) {
        // 如果是 xxx_edit.png 格式，原文件名为 xxx.png
        const match = downloadFileName.match(/^(.+?)(_edit\d*)?\.(\w+)$/);
        if (match) {
          originalName = `${match[1]}.${match[3]}`;
        }
      }
      
      // 获取保存目录路径
      const folderPath = directoryHandle ? directoryHandle.name : null;
      
      updateCompareView(
        originalImageSrc, 
        images[currentImageIndex].src,
        originalName,
        downloadFileName,
        folderPath
      );

      if (lightboxImg) lightboxImg.style.display = 'none';
      if (lightboxCompareView) lightboxCompareView.classList.remove('hidden');
      if (lightboxCompareBtn) lightboxCompareBtn.classList.add('active');
    }
  }

  function exitCompareMode() {
    isCompareMode = false;
    if (lightboxImg) lightboxImg.style.display = '';
    if (lightboxCompareView) lightboxCompareView.classList.add('hidden');
    if (lightboxCompareBtn) lightboxCompareBtn.classList.remove('active');
  }

  function toggleCompareMode() {
    if (isCompareMode) {
      exitCompareMode();
    } else {
      enterCompareMode();
    }
  }

  function openCompareView(editedImageSrc) {
    // 从瀑布流直接打开对比视图
    const images = getAllImages();
    const index = images.findIndex(img => img.src === editedImageSrc);

    if (index !== -1) {
      updateLightbox(index);
      lightbox.classList.add('active');
      // 自动进入对比模式
      enterCompareMode();
    }
  }

  function showPrevImage() {
    if (currentImageIndex > 0) {
      updateLightbox(currentImageIndex - 1);
    }
  }
  
  function showNextImage() {
    const images = getAllImages();
    if (currentImageIndex < images.length - 1) {
      updateLightbox(currentImageIndex + 1);
    }
  }
  
  // 关闭 lightbox 并重置状态
  function closeLightboxAndReset() {
    lightbox.classList.remove('active');
    currentImageIndex = -1;
    exitCompareMode();
    // 恢复导航按钮显示（批量预览模式下被隐藏）
    if (lightbox.dataset.batchPreview === 'true') {
      // 释放省内存模式下的临时 Object URL
      if (lightbox.dataset.tempObjectUrl) {
        URL.revokeObjectURL(lightbox.dataset.tempObjectUrl);
        delete lightbox.dataset.tempObjectUrl;
      }
      lightbox.dataset.batchPreview = 'false';
      if (lightboxPrev) lightboxPrev.style.display = '';
      if (lightboxNext) lightboxNext.style.display = '';
    }
  }

  if (lightbox && closeLightbox) {
    closeLightbox.addEventListener('click', (e) => {
      e.stopPropagation();
      closeLightboxAndReset();
    });

    lightbox.addEventListener('click', () => {
      closeLightboxAndReset();
    });

    // Prevent closing when clicking on the image
    if (lightboxImg) {
      lightboxImg.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    // Prevent closing when clicking on compare view
    if (lightboxCompareView) {
      lightboxCompareView.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    // Compare button
    if (lightboxCompareBtn) {
      lightboxCompareBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleCompareMode();
      });
    }

    // Navigation buttons
    if (lightboxPrev) {
      lightboxPrev.addEventListener('click', (e) => {
        e.stopPropagation();
        showPrevImage();
      });
    }

    if (lightboxNext) {
      lightboxNext.addEventListener('click', (e) => {
        e.stopPropagation();
        showNextImage();
      });
    }

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (!lightbox.classList.contains('active')) return;

      if (e.key === 'Escape') {
        closeLightboxAndReset();
      } else if (e.key === 'ArrowLeft') {
        showPrevImage();
      } else if (e.key === 'ArrowRight') {
        showNextImage();
      } else if (e.key === 'c' || e.key === 'C') {
        // 按 C 键切换对比模式
        if (lightboxCompareBtn && !lightboxCompareBtn.classList.contains('hidden')) {
          toggleCompareMode();
        }
      }
    });
  }

  // Make floating actions draggable
  const floatingActions = document.getElementById('floatingActions');
  if (floatingActions) {
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;
    
    floatingActions.style.touchAction = 'none';
    
    floatingActions.addEventListener('pointerdown', (e) => {
      if (e.target.tagName.toLowerCase() === 'button' || e.target.closest('button')) return;
      
      e.preventDefault();
      isDragging = true;
      floatingActions.setPointerCapture(e.pointerId);
      startX = e.clientX;
      startY = e.clientY;
      
      const rect = floatingActions.getBoundingClientRect();
      
      if (!floatingActions.style.left || floatingActions.style.left === '') {
        floatingActions.style.left = rect.left + 'px';
        floatingActions.style.top = rect.top + 'px';
        floatingActions.style.transform = 'none';
        floatingActions.style.bottom = 'auto';
      }
      
      initialLeft = parseFloat(floatingActions.style.left);
      initialTop = parseFloat(floatingActions.style.top);
      
      floatingActions.classList.add('shadow-xl');
    });
    
    document.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      
      floatingActions.style.left = `${initialLeft + dx}px`;
      floatingActions.style.top = `${initialTop + dy}px`;
    });
    
    document.addEventListener('pointerup', (e) => {
      if (isDragging) {
        isDragging = false;
        floatingActions.releasePointerCapture(e.pointerId);
        floatingActions.classList.remove('shadow-xl');
      }
    });
  }

  // ========== 批量编辑模式 ==========
  const batchImageUpload = document.getElementById('batchImageUpload');
  const batchSelectFilesBtn = document.getElementById('batchSelectFilesBtn');
  const batchSelectDirBtn = document.getElementById('batchSelectDirBtn');
  const batchFileInput = document.getElementById('batchFileInput');
  const batchGridContainer = document.getElementById('batchGridContainer');
  const batchGrid = document.getElementById('batchGrid');
  const batchImageCount = document.getElementById('batchImageCount');
  const batchSelectAllBtn = document.getElementById('batchSelectAllBtn');
  const batchClearBtn = document.getElementById('batchClearBtn');
  const batchProgressContainer = document.getElementById('batchProgressContainer');
  const batchProgressBar = document.getElementById('batchProgressBar');
  const batchProgressText = document.getElementById('batchProgressText');
  const batchLogContainer = document.getElementById('batchLogContainer');
  const batchLogList = document.getElementById('batchLogList');
  const batchLogCopyBtn = document.getElementById('batchLogCopyBtn');
  const batchLogClearBtn = document.getElementById('batchLogClearBtn');
  const batchRangeStart = document.getElementById('batchRangeStart');
  const batchRangeEnd = document.getElementById('batchRangeEnd');
  const batchTotalCount = document.getElementById('batchTotalCount');
  const batchSkipExisting = document.getElementById('batchSkipExisting');
  const batchShowPreview = document.getElementById('batchShowPreview');
  const batchMemorySaver = document.getElementById('batchMemorySaver');

  // 批量编辑状态
  let batchFiles = []; // 存储所有导入的 File 对象
  let batchSelectedSet = new Set(); // 存储选中的索引
  let batchProcessing = false;
  let batchLogs = []; // 存储日志
  let batchObjectURLs = []; // 省内存模式：跟踪 Object URL 以便释放
  const BATCH_CONCURRENCY = 3; // 最大并发数
  const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/jpg'];

  // 检测目录选择 API 支持
  const supportsDirectoryPicker = 'showDirectoryPicker' in window;
  if (!supportsDirectoryPicker && batchSelectDirBtn) {
    batchSelectDirBtn.style.display = 'none';
  }

  // 扩展模式切换函数
  const originalSwitchImagineMode = switchImagineMode;
  switchImagineMode = function(mode) {
    imagineMode = mode;
    imagineModeBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.imagineMode === mode));
    
    // 显示/隐藏编辑模式上传区域
    if (editImageUpload) {
      editImageUpload.classList.toggle('hidden', mode !== 'edit');
    }
    
    // 显示/隐藏批量编辑模式上传区域
    if (batchImageUpload) {
      batchImageUpload.classList.toggle('hidden', mode !== 'batch');
    }
    
    // 更新瀑布流预览状态（批量模式+省内存时禁用预览）
    if (typeof updateWaterfallPreviewState === 'function') {
      updateWaterfallPreviewState();
    }
  };

  // 过滤有效图片文件
  function filterImageFiles(files) {
    return Array.from(files).filter(file => {
      const type = (file.type || '').toLowerCase();
      if (ALLOWED_TYPES.includes(type)) return true;
      // 通过扩展名判断
      const ext = (file.name || '').split('.').pop().toLowerCase();
      return ['png', 'jpg', 'jpeg', 'webp'].includes(ext);
    });
  }

  // 添加批量图片
  async function addBatchFiles(files) {
    const validFiles = filterImageFiles(files);
    if (validFiles.length === 0) {
      toast('没有找到有效的图片文件', 'warning');
      return;
    }

    // 追加到现有文件列表
    const startIndex = batchFiles.length;
    batchFiles.push(...validFiles);

    // 默认全选新添加的图片
    validFiles.forEach((_, i) => {
      batchSelectedSet.add(startIndex + i);
    });

    renderBatchGrid();
    toast(`已添加 ${validFiles.length} 张图片`, 'success');
  }

  // 从目录读取图片
  async function readDirectoryFiles(dirHandle) {
    const files = [];
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'file') {
        const file = await entry.getFile();
        if (filterImageFiles([file]).length > 0) {
          files.push(file);
        }
      }
    }
    return files;
  }

  // 渲染批量图片网格
  function renderBatchGrid() {
    if (!batchGrid || !batchGridContainer || !batchImageCount) return;

    if (batchFiles.length === 0) {
      batchGridContainer.classList.add('hidden');
      updateBatchSelectedCount();
      return;
    }

    batchGridContainer.classList.remove('hidden');
    
    // 根据预览开关决定是否显示缩略图
    const showPreview = batchShowPreview?.checked;
    if (showPreview) {
      batchGrid.classList.remove('hidden');
    } else {
      batchGrid.classList.add('hidden');
    }

    batchGrid.innerHTML = '';
    revokeBatchObjectURLs(); // 释放旧的 Object URL

    const memorySaverEnabled = batchMemorySaver?.checked;

    batchFiles.forEach((file, index) => {
      const card = document.createElement('div');
      card.className = 'batch-image-card';
      card.dataset.index = index;

      // 设置选中状态
      if (batchSelectedSet.has(index)) {
        card.classList.add('selected');
      } else {
        card.classList.add('unselected');
      }

      // 图片缩略图
      const img = document.createElement('img');
      img.alt = file.name;
      img.loading = 'lazy';

      // 生成缩略图
      if (memorySaverEnabled) {
        // 省内存模式：用 Object URL 替代 base64
        const objUrl = URL.createObjectURL(file);
        img.src = objUrl;
        batchObjectURLs.push(objUrl);
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          img.src = e.target.result;
          card.dataset.imageUrl = e.target.result; // 存储用于预览
        };
        reader.readAsDataURL(file);
      }

      // 选择框 - 右上角，更大点击区域
      const checkbox = document.createElement('div');
      checkbox.className = 'batch-image-checkbox';
      checkbox.innerHTML = '<div class="batch-image-checkbox-inner"></div>';
      checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleBatchSelection(index);
      });

      // 删除按钮 - 左上角，仅非选中状态显示
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'batch-image-delete';
      deleteBtn.innerHTML = '&times;';
      deleteBtn.title = '删除图片';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeBatchFile(index);
      });

      // 文件名
      const nameLabel = document.createElement('div');
      nameLabel.className = 'batch-image-name';
      nameLabel.textContent = file.name;

      card.appendChild(img);
      card.appendChild(checkbox);
      card.appendChild(deleteBtn);
      card.appendChild(nameLabel);

      // 点击图片预览大图
      card.addEventListener('click', () => {
        openBatchPreview(index);
      });

      batchGrid.appendChild(card);
    });

    updateBatchSelectedCount();
  }

  // 删除单个批量图片
  function removeBatchFile(index) {
    batchFiles.splice(index, 1);
    // 更新选中集合的索引
    const newSelectedSet = new Set();
    batchSelectedSet.forEach(i => {
      if (i < index) {
        newSelectedSet.add(i);
      } else if (i > index) {
        newSelectedSet.add(i - 1);
      }
      // i === index 的被删除，不添加
    });
    batchSelectedSet = newSelectedSet;
    renderBatchGrid();
    toast('已删除图片', 'success');
  }

  // 打开批量图片预览
  function openBatchPreview(index) {
    const memorySaverEnabled = batchMemorySaver?.checked;
    let previewUrl = null;

    if (memorySaverEnabled) {
      // 省内存模式：按需创建临时 Object URL
      const file = batchFiles[index];
      if (!file) return;
      previewUrl = URL.createObjectURL(file);
    } else {
      const card = batchGrid?.querySelector(`[data-index="${index}"]`);
      if (!card || !card.dataset.imageUrl) return;
      previewUrl = card.dataset.imageUrl;
    }

    // 使用现有的 lightbox 显示预览
    if (lightboxImg && lightbox) {
      lightboxImg.src = previewUrl;
      // 隐藏对比按钮（批量预览不需要对比）
      if (lightboxCompareBtn) {
        lightboxCompareBtn.classList.add('hidden');
      }
      lightbox.classList.add('active');
      // 标记为批量预览模式，禁用左右导航
      lightbox.dataset.batchPreview = 'true';
      // 省内存模式：记录临时 URL，关闭时释放
      if (memorySaverEnabled) {
        lightbox.dataset.tempObjectUrl = previewUrl;
      }
      if (lightboxPrev) lightboxPrev.style.display = 'none';
      if (lightboxNext) lightboxNext.style.display = 'none';
    }
  }

  // 切换单个图片选中状态
  function toggleBatchSelection(index) {
    if (batchSelectedSet.has(index)) {
      batchSelectedSet.delete(index);
    } else {
      batchSelectedSet.add(index);
    }
    updateBatchCardState(index);
    updateBatchSelectedCount(); // 更新选中数量显示
  }

  // 更新单个卡片状态
  function updateBatchCardState(index) {
    const card = batchGrid?.querySelector(`[data-index="${index}"]`);
    if (!card) return;

    if (batchSelectedSet.has(index)) {
      card.classList.add('selected');
      card.classList.remove('unselected');
    } else {
      card.classList.remove('selected');
      card.classList.add('unselected');
    }
  }

  // 更新选中数量显示
  function updateBatchSelectedCount() {
    if (batchImageCount) {
      batchImageCount.textContent = batchSelectedSet.size;
    }
    // 更新范围设置
    updateBatchRangeSettings();
  }

  // 更新范围设置
  function updateBatchRangeSettings() {
    const total = batchFiles.length;
    if (batchTotalCount) {
      batchTotalCount.textContent = total;
    }
    if (batchRangeEnd && total > 0) {
      batchRangeEnd.max = total;
      if (parseInt(batchRangeEnd.value, 10) < 1 || parseInt(batchRangeEnd.value, 10) > total) {
        batchRangeEnd.value = total;
      }
    }
    if (batchRangeStart && total > 0) {
      batchRangeStart.max = total;
      if (parseInt(batchRangeStart.value, 10) < 1) {
        batchRangeStart.value = 1;
      }
    }
  }

  // ========== 日志功能 ==========
  function addBatchLog(type, message) {
    const now = new Date();
    const timeStr = now.toTimeString().slice(0, 8);
    const logEntry = { type, message, time: timeStr, timestamp: now.getTime() };
    batchLogs.push(logEntry);

    // 显示日志容器
    if (batchLogContainer) {
      batchLogContainer.classList.remove('hidden');
    }

    // 添加日志项
    if (batchLogList) {
      const item = document.createElement('div');
      item.className = 'batch-log-item';
      item.innerHTML = `
        <span class="batch-log-time">${timeStr}</span>
        <span class="batch-log-type ${type}">${getLogTypeLabel(type)}</span>
        <span class="batch-log-message">${escapeHtml(message)}</span>
      `;
      batchLogList.appendChild(item);
      // 自动滚动到底部
      batchLogList.scrollTop = batchLogList.scrollHeight;
    }
  }

  function getLogTypeLabel(type) {
    const labels = {
      info: 'INFO',
      success: '成功',
      warn: '警告',
      error: '错误',
      skip: '跳过'
    };
    return labels[type] || type.toUpperCase();
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function clearBatchLogs() {
    batchLogs = [];
    if (batchLogList) {
      batchLogList.innerHTML = '';
    }
    if (batchLogContainer) {
      batchLogContainer.classList.add('hidden');
    }
  }

  function copyBatchLogs() {
    if (batchLogs.length === 0) {
      toast('没有日志可复制', 'warning');
      return;
    }
    const text = batchLogs.map(log => `[${log.time}] [${getLogTypeLabel(log.type)}] ${log.message}`).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      toast('日志已复制到剪贴板', 'success');
    }).catch(() => {
      toast('复制失败', 'error');
    });
  }

  // 检查文件是否存在于目标目录
  async function checkFileExists(filename) {
    if (!directoryHandle) return false;
    try {
      await directoryHandle.getFileHandle(filename, { create: false });
      return true;
    } catch (e) {
      return false;
    }
  }

  // 获取输出文件名（保持原文件名）
  function getOutputFilename(originalFilename, ext) {
    const lastDot = originalFilename.lastIndexOf('.');
    const baseName = lastDot > 0 ? originalFilename.substring(0, lastDot) : originalFilename;
    return `${baseName}.${ext}`;
  }

  // 全选
  function batchSelectAll() {
    batchFiles.forEach((_, i) => batchSelectedSet.add(i));
    // 增量更新现有卡片 class，避免全量重建 DOM
    const cards = batchGrid?.querySelectorAll('.batch-image-card');
    if (cards) {
      cards.forEach(card => {
        card.classList.add('selected');
        card.classList.remove('unselected');
      });
    }
    updateBatchSelectedCount();
  }

  // 释放所有批量缩略图的 Object URL
  function revokeBatchObjectURLs() {
    batchObjectURLs.forEach(url => URL.revokeObjectURL(url));
    batchObjectURLs = [];
  }

  // 清空批量图片
  function clearBatchFiles() {
    revokeBatchObjectURLs();
    batchFiles = [];
    batchSelectedSet.clear();
    renderBatchGrid();
    clearBatchErrors();
    hideBatchProgress();
  }

  // 获取选中的文件（0选中=全选）
  function getSelectedBatchFiles() {
    const getFileWithDataUrl = (file, index) => {
      const card = batchGrid?.querySelector(`[data-index="${index}"]`);
      const originalDataUrl = card?.dataset?.imageUrl || null;
      return { file, index, originalDataUrl };
    };

    if (batchSelectedSet.size === 0 || batchSelectedSet.size === batchFiles.length) {
      // 0 选中或全选，返回全部
      return batchFiles.map((file, index) => getFileWithDataUrl(file, index));
    }
    return Array.from(batchSelectedSet).map(index => getFileWithDataUrl(batchFiles[index], index));
  }

  // 更新进度条
  function updateBatchProgress(current, total) {
    if (!batchProgressContainer || !batchProgressBar || !batchProgressText) return;
    
    batchProgressContainer.classList.remove('hidden');
    const percent = total > 0 ? Math.round((current / total) * 100) : 0;
    batchProgressBar.style.width = `${percent}%`;
    batchProgressText.textContent = `${current}/${total}`;
  }

  // 隐藏进度条
  function hideBatchProgress() {
    if (batchProgressContainer) {
      batchProgressContainer.classList.add('hidden');
    }
    if (batchProgressBar) {
      batchProgressBar.style.width = '0%';
    }
    if (batchProgressText) {
      batchProgressText.textContent = '准备中...';
    }
  }

  // 添加错误信息
  function addBatchError(filename, message) {
    if (!batchErrorsContainer || !batchErrorsList) return;

    batchErrorsContainer.classList.remove('hidden');

    const item = document.createElement('div');
    item.className = 'batch-error-item';
    item.innerHTML = `
      <span class="batch-error-filename" title="${filename}">${filename}</span>
      <span class="batch-error-message">${message}</span>
    `;
    batchErrorsList.appendChild(item);
  }

  // 清空错误
  function clearBatchErrors() {
    if (batchErrorsList) {
      batchErrorsList.innerHTML = '';
    }
    if (batchErrorsContainer) {
      batchErrorsContainer.classList.add('hidden');
    }
  }

  // 单张图片编辑处理
  async function processEditSingle(file, prompt, apiKey) {
    const formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('image', file);
    formData.append('model', 'grok-imagine-1.0-edit');
    formData.append('n', '1');
    formData.append('response_format', 'b64_json');
    formData.append('size', 'original');

    const res = await fetch('/v1/images/edits', {
      method: 'POST',
      headers: buildAuthHeaders(apiKey),
      body: formData,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || `HTTP ${res.status}`);
    }

    const data = await res.json();
    if (data.data && data.data.length > 0 && data.data[0].b64_json) {
      const b64 = data.data[0].b64_json;
      // 验证返回的是否是有效的 base64 图片数据
      if (b64.startsWith('error') || b64.length < 100) {
        throw new Error(b64.startsWith('error') ? b64 : '返回的图片数据无效');
      }
      // 简单验证是否是有效 base64（尝试解码前几个字符）
      try {
        atob(b64.substring(0, 100));
      } catch (e) {
        throw new Error('返回的数据不是有效的 base64 编码');
      }
      return b64;
    }
    throw new Error('未获取到编辑结果');
  }

  // 批量处理
  async function processBatch() {
    const prompt = promptInput ? promptInput.value.trim() : '';
    if (!prompt) {
      toast('请输入提示词', 'error');
      return;
    }

    if (batchFiles.length === 0) {
      toast('请先选择要编辑的图片', 'error');
      return;
    }

    const apiKey = await ensureApiKey();
    if (apiKey === null) {
      toast('请先登录后台', 'error');
      return;
    }

    if (batchProcessing) {
      toast('正在处理中，请稍候', 'warning');
      return;
    }

    batchProcessing = true;
    setStatus('connecting', '批量处理中...');
    setButtons(true);
    clearBatchLogs();

    // 获取范围设置
    const rangeStart = Math.max(1, parseInt(batchRangeStart?.value, 10) || 1);
    const rangeEnd = Math.min(batchFiles.length, parseInt(batchRangeEnd?.value, 10) || batchFiles.length);
    const skipExisting = batchSkipExisting?.checked && directoryHandle;

    addBatchLog('info', `开始批量处理，范围：${rangeStart} - ${rangeEnd}，共 ${rangeEnd - rangeStart + 1} 张`);
    if (skipExisting) {
      addBatchLog('info', `已启用跳过已存在文件，保存目录：${directoryHandle.name}`);
    }

    // 按范围获取文件
    const selectedFiles = getSelectedBatchFiles();
    const rangeFiles = selectedFiles.filter((_, idx) => {
      const fileIndex = idx + 1; // 1-based
      return fileIndex >= rangeStart && fileIndex <= rangeEnd;
    });

    const total = rangeFiles.length;
    let completed = 0;
    let successCount = 0;
    let failCount = 0;
    let skipCount = 0;

    updateBatchProgress(0, total);

    // 分批并行处理
    for (let i = 0; i < rangeFiles.length; i += BATCH_CONCURRENCY) {
      const batch = rangeFiles.slice(i, i + BATCH_CONCURRENCY);

      // 预检查跳过已存在的文件
      const tasksToProcess = [];
      for (const item of batch) {
        const { file } = item;
        const outputFilename = getOutputFilename(file.name, 'png'); // 默认输出 png

        if (skipExisting) {
          const exists = await checkFileExists(outputFilename);
          if (exists) {
            completed++;
            skipCount++;
            updateBatchProgress(completed, total);
            addBatchLog('skip', `${file.name} → ${outputFilename} 已存在，跳过`);
            continue;
          }
        }
        tasksToProcess.push({ ...item, outputFilename });
      }

      if (tasksToProcess.length === 0) continue;

      const results = await Promise.allSettled(
        tasksToProcess.map(({ file }) => processEditSingle(file, prompt, apiKey))
      );

      // 处理结果
      for (let idx = 0; idx < results.length; idx++) {
        const result = results[idx];
        const { file, index, originalDataUrl, outputFilename } = tasksToProcess[idx];
        completed++;
        updateBatchProgress(completed, total);

        if (result.status === 'fulfilled') {
          successCount++;
          let b64 = result.value;
          const memorySaverEnabled = batchMemorySaver?.checked;
          const showPreview = waterfallShowPreview?.checked;

          // 自动保存（使用原文件名）
          let savedSuccessfully = false;
          if (autoDownloadToggle?.checked && directoryHandle) {
            try {
              await saveToFileSystem(b64, outputFilename);
              addBatchLog('success', `${file.name} → ${outputFilename} 保存成功`);
              savedSuccessfully = true;
            } catch (e) {
              addBatchLog('warn', `${file.name} 保存失败：${e.message}`);
            }
          } else {
            addBatchLog('success', `${file.name} 处理成功`);
          }

          // 添加到瀑布流（如果需要预览）
          imageCount++;
          updateCount(imageCount);

          // 调试日志
          console.log('[Batch] 处理结果:', {
            fileName: file.name,
            showPreview,
            memorySaverEnabled,
            savedSuccessfully,
            b64Length: b64?.length || 0
          });

          // 如果开启了显示预览，总是添加到瀑布流
          if (showPreview) {
            console.log('[Batch] 添加到瀑布流:', file.name);
            appendImage(b64, {
              sequence: imageCount,
              elapsed_ms: 0,
              prompt: prompt,
              originalImage: memorySaverEnabled ? null : originalDataUrl,
              originalFileIndex: memorySaverEnabled ? index : null, // 存储文件索引用于按需读取
              downloadFileName: outputFilename,
            });
          }
          
          // 省内存模式 + 保存成功：释放 base64 引用（但已经添加到瀑布流了）
          if (memorySaverEnabled && savedSuccessfully && !showPreview) {
            b64 = null;
          }
        } else {
          failCount++;
          const errorMsg = result.reason?.message || '处理失败';
          addBatchLog('error', `${file.name} 失败：${errorMsg}`);
        }
      }
    }

    batchProcessing = false;
    setButtons(false);

    // 汇总日志
    addBatchLog('info', `处理完成：成功 ${successCount}，失败 ${failCount}，跳过 ${skipCount}`);

    if (failCount === 0 && skipCount === 0) {
      setStatus('connected', '批量处理完成');
      toast(`成功处理 ${successCount} 张图片`, 'success');
    } else if (successCount > 0) {
      setStatus('connected', '批量处理完成');
      toast(`处理完成：成功 ${successCount}，失败 ${failCount}，跳过 ${skipCount}`, 'warning');
    } else if (skipCount > 0 && failCount === 0) {
      setStatus('connected', '全部跳过');
      toast(`所有文件已存在，跳过 ${skipCount} 张`, 'info');
    } else {
      setStatus('error', '批量处理失败');
      toast('所有图片处理失败，请查看日志', 'error');
    }
  }

  // 绑定批量编辑事件
  if (batchSelectFilesBtn && batchFileInput) {
    batchSelectFilesBtn.addEventListener('click', () => {
      batchFileInput.click();
    });

    batchFileInput.addEventListener('change', () => {
      if (batchFileInput.files && batchFileInput.files.length > 0) {
        addBatchFiles(batchFileInput.files);
        batchFileInput.value = ''; // 重置，允许重复选择
      }
    });
  }

  if (batchSelectDirBtn && supportsDirectoryPicker) {
    batchSelectDirBtn.addEventListener('click', async () => {
      try {
        const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
        const files = await readDirectoryFiles(dirHandle);
        if (files.length > 0) {
          await addBatchFiles(files);
        } else {
          toast('所选目录中没有找到图片文件', 'warning');
        }
      } catch (e) {
        if (e.name !== 'AbortError') {
          toast('选择目录失败: ' + e.message, 'error');
        }
      }
    });
  }

  if (batchSelectAllBtn) {
    batchSelectAllBtn.addEventListener('click', batchSelectAll);
  }

  if (batchClearBtn) {
    batchClearBtn.addEventListener('click', clearBatchFiles);
  }

  if (batchLogCopyBtn) {
    batchLogCopyBtn.addEventListener('click', copyBatchLogs);
  }

  if (batchLogClearBtn) {
    batchLogClearBtn.addEventListener('click', clearBatchLogs);
  }

  // 预览开关事件
  if (batchShowPreview) {
    batchShowPreview.addEventListener('change', () => {
      renderBatchGrid();
    });
  }

  // 省内存模式和瀑布流预览的联动
  const previewDisabledHint = document.getElementById('previewDisabledHint');
  
  function updateWaterfallPreviewState() {
    const memorySaverEnabled = batchMemorySaver?.checked;
    const isBatchMode = imagineMode === 'batch';
    
    if (waterfallShowPreview) {
      if (isBatchMode && memorySaverEnabled) {
        // 省内存模式开启时，禁用显示预览
        waterfallShowPreview.disabled = true;
        waterfallShowPreview.checked = false;
        waterfallShowPreview.parentElement?.classList.add('opacity-50', 'cursor-not-allowed');
        if (previewDisabledHint) previewDisabledHint.classList.remove('hidden');
        if (waterfall) waterfall.style.display = 'none';
      } else {
        // 非省内存模式或非批量模式，启用显示预览
        waterfallShowPreview.disabled = false;
        waterfallShowPreview.parentElement?.classList.remove('opacity-50', 'cursor-not-allowed');
        if (previewDisabledHint) previewDisabledHint.classList.add('hidden');
      }
    }
  }

  // 省内存模式切换时更新预览状态
  if (batchMemorySaver) {
    batchMemorySaver.addEventListener('change', updateWaterfallPreviewState);
  }

  // 瀑布流预览开关事件
  if (waterfallShowPreview && waterfall) {
    waterfallShowPreview.addEventListener('change', () => {
      if (waterfallShowPreview.checked) {
        waterfall.style.display = '';
      } else {
        waterfall.style.display = 'none';
      }
    });
  }

  // 修改开始按钮处理，支持批量模式
  if (startBtn) {
    const originalStartHandler = startBtn.onclick;
    startBtn.onclick = null;
    startBtn.addEventListener('click', () => {
      if (imagineMode === 'batch') {
        processBatch();
      } else if (imagineMode === 'edit') {
        startEditMode();
      } else {
        startConnection();
      }
    });
  }
})();
