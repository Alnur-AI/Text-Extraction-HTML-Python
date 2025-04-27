const input = document.getElementById('audio-input');
const container = document.getElementById('upload-container');
const notification = document.getElementById('notification');
const fileInfo = document.getElementById('file-info');
const waveformContainer = document.getElementById('waveform-container');
const overviewCanvas = document.getElementById('overview-canvas');
const selectionCanvas = document.getElementById('selection-canvas');

let audioBuffer = null;
let selectionStart = 0; // seconds
let selectionDuration = 20; // seconds

input.addEventListener('change', async function () {
    const file = input.files[0];
    if (file && (file.type === 'audio/mpeg' || file.type === 'audio/wav')) {
        // Показать уведомление на 1 секунду
        notification.textContent = "Файл загружен ✅";
        notification.classList.remove('hidden');
        notification.style.display = 'block';

        // Этап 1: "приземление" в левый верхний угол
        container.classList.add('landing');

        setTimeout(() => {
            notification.style.display = 'none';
        }, 1000);
        setTimeout(() => {
            container.classList.add('stretched');
        }, 500);
        

        // Показать имя файла
        //fileInfo.textContent = `Текущий файл: ${file.name}`;

        // Переместить кнопку вверх-влево
        container.style.top = '20px';
        container.style.left = '20px';
        container.style.transform = 'none';
        container.classList.add('stretched');

        // Загрузка и декодирование аудиофайла
        const arrayBuffer = await file.arrayBuffer();
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

        waveformContainer.classList.remove('hidden');
        selectionStart = 0;
        drawOverview();
        drawSelection();
    }
});


function formatTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
}

function drawOverview() {
    const ctx = overviewCanvas.getContext('2d');
    ctx.clearRect(0, 0, overviewCanvas.width, overviewCanvas.height);
    drawWaveform(ctx, overviewCanvas.width, overviewCanvas.height, audioBuffer, 0, audioBuffer.duration);

    // Draw selection rectangle
    const startX = (selectionStart / audioBuffer.duration) * overviewCanvas.width;
    const width = (selectionDuration / audioBuffer.duration) * overviewCanvas.width;
    ctx.fillStyle = 'rgba(128,0,255,0.25)';
    ctx.fillRect(startX, 0, width, overviewCanvas.height);

    // Draw time labels
    ctx.font = '12px Arial';
    ctx.fillStyle = '#333';
    ctx.textAlign = 'left';
    ctx.fillText(formatTime(0), 2, overviewCanvas.height - 2);
    ctx.textAlign = 'right';
    ctx.fillText(formatTime(audioBuffer.duration), overviewCanvas.width - 2, overviewCanvas.height - 2);
}

function drawSelection() {
    const ctx = selectionCanvas.getContext('2d');
    ctx.clearRect(0, 0, selectionCanvas.width, selectionCanvas.height);
    drawWaveform(ctx, selectionCanvas.width, selectionCanvas.height, audioBuffer, selectionStart, selectionStart + selectionDuration);

    // Draw time labels
    ctx.font = '12px Arial';
    ctx.fillStyle = '#333';
    ctx.textAlign = 'left';
    ctx.fillText(formatTime(selectionStart), 2, selectionCanvas.height - 2);
    ctx.textAlign = 'right';
    ctx.fillText(formatTime(selectionStart + selectionDuration), selectionCanvas.width - 2, selectionCanvas.height - 2);
}

function drawWaveform(ctx, width, height, buffer, startSec, endSec) {
    if (!buffer) return;
    const channel = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;
    const startSample = Math.floor(startSec * sampleRate);
    const endSample = Math.min(Math.floor(endSec * sampleRate), channel.length);
    const samplesPerPixel = Math.max(1, Math.floor((endSample - startSample) / width));

    ctx.beginPath();
    for (let x = 0; x < width; x++) {
        const sampleStart = startSample + x * samplesPerPixel;
        let min = 1, max = -1;
        for (let i = 0; i < samplesPerPixel; i++) {
            const s = channel[sampleStart + i] || 0;
            if (s < min) min = s;
            if (s > max) max = s;
        }
        const y1 = ((1 - min) / 2) * height;
        const y2 = ((1 - max) / 2) * height;
        ctx.moveTo(x, y1);
        ctx.lineTo(x, y2);
    }
    ctx.strokeStyle = '#2196f3'; // голубой цвет
    ctx.lineWidth = 1;
    ctx.stroke();
}
let isDragging = false;
let dragOffset = 0;

overviewCanvas.addEventListener('mousedown', (e) => {
    if (!audioBuffer) return;
    const rect = overviewCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const startX = (selectionStart / audioBuffer.duration) * overviewCanvas.width;
    const width = (selectionDuration / audioBuffer.duration) * overviewCanvas.width;
    // Проверяем, попал ли клик в прямоугольник выделения
    if (x >= startX && x <= startX + width) {
        isDragging = true;
        dragOffset = x - startX;
        document.body.style.cursor = 'grabbing';
    }
});

overviewCanvas.addEventListener('wheel', (e) => {
    if (!audioBuffer) return;
    e.preventDefault();

    // Масштабируем только если не происходит drag (isDragging)
    if (isDragging) return;

    const scaleStep = 1.2;
    const rect = overviewCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mousePercent = mouseX / overviewCanvas.width;
    const mouseTime = mousePercent * audioBuffer.duration;

    let newDuration = selectionDuration;

    if (e.deltaY < 0) {
        // колесо вверх — увеличить область (уменьшить масштаб)
        newDuration *= scaleStep;
    } else {
        // колесо вниз — уменьшить область (увеличить масштаб)
        newDuration /= scaleStep;
    }

    newDuration = Math.max(2, Math.min(audioBuffer.duration, newDuration));

    // Центрируем прямоугольник относительно мыши
    let newStart = mouseTime - (mousePercent * newDuration);
    newStart = Math.max(0, Math.min(audioBuffer.duration - newDuration, newStart));

    selectionStart = newStart;
    selectionDuration = newDuration;

    drawOverview();
    drawSelection();
}, { passive: false });

window.addEventListener('mousemove', (e) => {
    if (!audioBuffer || !isDragging) return;
    const rect = overviewCanvas.getBoundingClientRect();
    let x = e.clientX - rect.left - dragOffset;
    x = Math.max(0, Math.min(overviewCanvas.width - (selectionDuration / audioBuffer.duration) * overviewCanvas.width, x));
    selectionStart = (x / overviewCanvas.width) * audioBuffer.duration;
    selectionStart = Math.max(0, Math.min(audioBuffer.duration - selectionDuration, selectionStart));
    drawOverview();
    drawSelection();
});

window.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        document.body.style.cursor = '';
    }
});

// ...оставьте обработчик click для быстрого перемещения:
overviewCanvas.addEventListener('click', (e) => {
    if (!audioBuffer || isDragging) return;
    const rect = overviewCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / overviewCanvas.width;
    selectionStart = Math.max(0, Math.min(audioBuffer.duration - selectionDuration, percent * audioBuffer.duration));
    drawOverview();
    drawSelection();
});
document.addEventListener('keydown', (e) => {
    if (!audioBuffer) return;
    if (e.key === 'ArrowLeft') {
        selectionStart = Math.max(0, selectionStart - 5);
        drawOverview();
        drawSelection();
    } else if (e.key === 'ArrowRight') {
        selectionStart = Math.min(audioBuffer.duration - selectionDuration, selectionStart + 5);
        drawOverview();
        drawSelection();
    }
});


const playBtn = document.getElementById('play-btn');
const transcribeBtn = document.getElementById('transcribe-btn');
const clearSelectionBtn = document.getElementById('clear-selection-btn');
const controls = document.getElementById('controls');
const transcript = document.getElementById('transcript');

let selRegion = null; // {startX, endX} в пикселях
let selRegionSec = null; // {start, end} в секундах
let isSelecting = false;
let audioCtx, source, animationId;
let playStartTime = 0;
let playDuration = 0;
let playRegion = null; // {start, end} в секундах

// Показываем контролы после загрузки
function showControls() {
    controls.classList.remove('hidden');
    transcript.style.display = 'block';
}

// --- Выделение мышью на selection-canvas ---
selectionCanvas.addEventListener('mousedown', (e) => {
    if (!audioBuffer) return;
    isSelecting = true;
    const rect = selectionCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    selRegion = {startX: x, endX: x};
    selRegionSec = null;
    drawSelection();
});
selectionCanvas.addEventListener('mousemove', (e) => {
    if (!audioBuffer || !isSelecting) return;
    const rect = selectionCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    selRegion.endX = x;
    drawSelection();
});
window.addEventListener('mouseup', () => {
    if (!audioBuffer || !isSelecting) return;
    isSelecting = false;
    if (selRegion) {
        // Преобразуем в секунды
        let x1 = Math.max(0, Math.min(selectionCanvas.width, selRegion.startX));
        let x2 = Math.max(0, Math.min(selectionCanvas.width, selRegion.endX));
        if (x1 === x2) {
            selRegionSec = null;
        } else {
            let start = selectionStart + (Math.min(x1, x2) / selectionCanvas.width) * selectionDuration;
            let end = selectionStart + (Math.max(x1, x2) / selectionCanvas.width) * selectionDuration;
            selRegionSec = {start, end};
        }
        drawSelection();
    }
});

// --- Кнопки ---
playBtn.addEventListener('click', () => {
    if (!audioBuffer) return;
    let region = selRegionSec && selRegionSec.start !== selRegionSec.end
        ? selRegionSec
        : {start: selectionStart, end: selectionStart + selectionDuration};
    playAudioRegion(region.start, region.end);
});
clearSelectionBtn.addEventListener('click', () => {
    selRegion = null;
    selRegionSec = null;
    drawSelection();
});

// --- Воспроизведение с красной полоской ---
function playAudioRegion(start, end) {
    if (!audioBuffer) return;
    if (source) {
        source.stop();
        source.disconnect();
    }
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioCtx.destination);
    playStartTime = audioCtx.currentTime;
    playDuration = end - start;
    playRegion = {start, end};
    source.start(0, start, playDuration);
    drawSelection(); // нарисовать красную полоску
    animatePlayhead();
    source.onended = () => {
        cancelAnimationFrame(animationId);
        playRegion = null;
        drawSelection();
    };
}
function animatePlayhead() {
    if (!playRegion) return;
    drawSelection();
    const now = audioCtx.currentTime;
    const elapsed = now - playStartTime;
    if (elapsed < playDuration) {
        animationId = requestAnimationFrame(animatePlayhead);
    }
}

// --- Модифицируйте drawSelection для выделения и красной полоски ---
function drawSelection() {
    const ctx = selectionCanvas.getContext('2d');
    ctx.clearRect(0, 0, selectionCanvas.width, selectionCanvas.height);
    drawWaveform(ctx, selectionCanvas.width, selectionCanvas.height, audioBuffer, selectionStart, selectionStart + selectionDuration);

    // Выделение области мышью
    if (selRegion && (selRegion.startX !== selRegion.endX)) {
        let x1 = Math.max(0, Math.min(selectionCanvas.width, selRegion.startX));
        let x2 = Math.max(0, Math.min(selectionCanvas.width, selRegion.endX));
        ctx.fillStyle = 'rgba(33,150,243,0.25)';
        ctx.fillRect(Math.min(x1, x2), 0, Math.abs(x2 - x1), selectionCanvas.height);
    }
    // Если выделение задано в секундах (после mouseup)
    if (selRegionSec && selRegionSec.start !== selRegionSec.end) {
        let x1 = ((selRegionSec.start - selectionStart) / selectionDuration) * selectionCanvas.width;
        let x2 = ((selRegionSec.end - selectionStart) / selectionDuration) * selectionCanvas.width;
        ctx.fillStyle = 'rgba(33,150,243,0.25)';
        ctx.fillRect(Math.min(x1, x2), 0, Math.abs(x2 - x1), selectionCanvas.height);
    }

    // Красная полоска при воспроизведении
    if (playRegion) {
        const now = audioCtx.currentTime;
        const elapsed = now - playStartTime;
        let rel = Math.min(1, Math.max(0, elapsed / playDuration));
        let x1 = ((playRegion.start - selectionStart) / selectionDuration) * selectionCanvas.width;
        let x2 = ((playRegion.end - selectionStart) / selectionDuration) * selectionCanvas.width;
        let playX = x1 + (x2 - x1) * rel;
        playX = Math.max(x1, Math.min(x2, playX));
        ctx.save();
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(playX, 0);
        ctx.lineTo(playX, selectionCanvas.height);
        ctx.stroke();
        ctx.restore();
    }

    // Время
    ctx.font = '12px Arial';
    ctx.fillStyle = '#333';
    ctx.textAlign = 'left';
    ctx.fillText(formatTime(selectionStart), 2, selectionCanvas.height - 2);
    ctx.textAlign = 'right';
    ctx.fillText(formatTime(selectionStart + selectionDuration), selectionCanvas.width - 2, selectionCanvas.height - 2);
}


const progressBarContainer = document.getElementById('progress-bar-container');
const progressBar = document.getElementById('progress-bar');
const progressLabel = document.getElementById('progress-label');


// --- Прогресс-бар ---
let progressFake = 1;
let progressInterval = null;

function showProgressBar(label, percent) {
    progressBarContainer.classList.remove('hidden');
    progressBar.style.width = percent + '%';
    progressLabel.textContent = label;

    // Имитация плавного роста до 98%
    if (percent < 100) {
        progressFake = percent;
        clearInterval(progressInterval);
        progressInterval = setInterval(() => {
            if (progressFake < 98) {
                progressFake += 0.02;
                progressBar.style.width = progressFake + '%';
            }
        }, 30);
    }
}

function hideProgressBar() {
    progressBarContainer.classList.add('hidden');
    progressBar.style.width = '0%';
    progressLabel.textContent = '';
    clearInterval(progressInterval);
}


// --- Преобразование PCM в WAV ---
function encodeWAV(samples, sampleRate) {
    // Простой WAV encoder для 16-bit PCM mono
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    function writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);

    // PCM samples
    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
        let s = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return new Blob([buffer], {type: 'audio/wav'});
}



const transcriptStack = document.getElementById('transcript-stack');

transcribeBtn.addEventListener('click', async () => {
    if (!audioBuffer) return;
    let region = selRegionSec && selRegionSec.start !== selRegionSec.end
        ? selRegionSec
        : {start: selectionStart, end: selectionStart + selectionDuration};

    // Вырезаем нужный фрагмент аудио
    const sampleRate = audioBuffer.sampleRate;
    const startSample = Math.floor(region.start * sampleRate);
    const endSample = Math.floor(region.end * sampleRate);
    const audioSegment = audioBuffer.getChannelData(0).slice(startSample, endSample);

    // Преобразуем в WAV (или другой формат, поддерживаемый сервером)
    const wavBlob = encodeWAV(audioSegment, sampleRate);

    // Показываем прогресс-бар
    showProgressBar('Отправлено в Whisper на расшифровку...', 1);

    // Отправляем на сервер
    const formData = new FormData();
    formData.append('audio', wavBlob, 'fragment.wav');

    // Запрос на сервер (Flask/FastAPI)
    const response = await fetch('http://127.0.0.1:5000/transcribe', {
        method: 'POST',
        body: formData
    });

    // Ожидаем прогресс (можно реализовать через SSE/WebSocket или polling)
    //showProgressBar('Расшифровка...', 99);

    // ...после получения ответа...
    const result = await response.json();
    if (result.status === "error") {
        alert("Ошибка при расшифровке аудио на сервере.");
        transcript.value = '';
        return;
    }
    transcript.value = result.text || '';
    showProgressBar('Расшифровка завершена', 100);
    setTimeout(hideProgressBar, 400);
    addTranscriptBlock(region.start, region.end, result.text || '');
});

// --- Добавить блок в стек ---
function addTranscriptBlock(startSec, endSec, text) {
    const block = document.createElement('div');
    block.className = 'transcript-block';

    // Время
    const timeStr = `${formatTime(startSec)} — ${formatTime(endSec)}`;
    // Дата
    const dateStr = new Date().toLocaleString('ru-RU', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    block.innerHTML = `
        <div class="transcript-block-content">${text || '<i>Нет текста</i>'}</div>
        <div class="transcript-block-footer">
            <div class="transcript-block-time">${timeStr}</div>
            <div class="transcript-block-speaker">
                <input type="text" placeholder="Имя спикера">
            </div>
            <div class="transcript-block-date">${dateStr}</div>
        </div>
    `;
    transcriptStack.appendChild(block);
}