from flask import Flask, request, jsonify
import whisper
import tempfile
import os
import time
from datetime import datetime

from flask_cors import CORS

app = Flask(__name__)
CORS(app)

print(f"[{datetime.now()}] Запуск сервера и загрузка модели Whisper (large)...")
start_model_load = time.time()
model = whisper.load_model("large")
end_model_load = time.time()
print(f"[{datetime.now()}] Модель Whisper загружена за {end_model_load - start_model_load:.2f} секунд.")

@app.route('/transcribe', methods=['POST'])
def transcribe():
    client_ip = request.remote_addr
    print(f"[{datetime.now()}] Получен запрос на /transcribe от {client_ip}")

    audio = request.files['audio']
    with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp:
        audio.save(tmp.name)
        print(f"[{datetime.now()}] Аудиофайл сохранён во временный файл: {tmp.name}")
        temp_filename = tmp.name

    try:
        start_time = time.time()
        print(f"[{datetime.now()}] Начата расшифровка аудио...")
        result = model.transcribe(temp_filename, language='ru')
        end_time = time.time()
        print(f"[{datetime.now()}] Расшифровка завершена за {end_time - start_time:.2f} секунд.")
        text = result['text']
        status = "ok"
    except Exception as e:
        print(f"[{datetime.now()}] Ошибка при расшифровке: {e}")
        text = ""
        status = "error"
    finally:
        try:
            os.unlink(temp_filename)
            print(f"[{datetime.now()}] Временный файл удалён: {temp_filename}")
        except Exception as e:
            print(f"[{datetime.now()}] Не удалось удалить временный файл: {e}")

    print(f"[{datetime.now()}] Отправка результата клиенту {client_ip}")
    print(f"[{datetime.now()}] Текст для клиента:\n{text}")
    return jsonify({'status': status, 'text': text})

if __name__ == '__main__':
    print(f"[{datetime.now()}] Сервер запущен на http://127.0.0.1:5000")
    app.run(host='127.0.0.1', port=5000, threaded=False)