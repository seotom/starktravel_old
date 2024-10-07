document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('reviewForm').addEventListener('submit', async function(event) {
        event.preventDefault();

        // Показываем индикатор загрузки и убираем кнопку "Закрыть"
        document.getElementById('loadingSpinner').classList.remove('d-none');
        document.getElementById('closeModalBtn').classList.add('d-none');
        document.getElementById('statusMessage').innerHTML = 'Идёт загрузка...';

        // Получаем значения полей формы
        const username = document.getElementById('username').value;
        const location = document.getElementById('location').value;
        const reviewText = document.getElementById('reviewText').value;
        const timestamp = new Date().toISOString();
        const photos = document.getElementById('photos').files;

        const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiIxMTM3ZWNiNy02Y2ZiLTQ1NTMtYjRiYy02Yjg1NWI3NTUxM2YiLCJlbWFpbCI6InNlb3RvbXJ1QGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJwaW5fcG9saWN5Ijp7InJlZ2lvbnMiOlt7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6IkZSQTEifSx7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6Ik5ZQzEifV0sInZlcnNpb24iOjF9LCJtZmFfZW5hYmxlZCI6ZmFsc2UsInN0YXR1cyI6IkFDVElWRSJ9LCJhdXRoZW50aWNhdGlvblR5cGUiOiJzY29wZWRLZXkiLCJzY29wZWRLZXlLZXkiOiI2NGVhNDc0MmIwZjI4MGFjZGFlYyIsInNjb3BlZEtleVNlY3JldCI6IjIxZWQ3NjBkNDQ1NDBhZDg3NjljMWMxMGVmNjI1ODBlN2Y2ZjlmZTgzYzNjMmY5YTI3NmQ5OTJkZTQ2NDAyYWIiLCJleHAiOjE3NTkxNjI1NTZ9._qAKlNzzI5H8tRlRrKPQcLH-D_z9bgLE1XPttaeW4_A';  // Замените на ваш JWT

        // Создаем объект с отзывом
        const reviewData = {
            author: username,
            location: location,
            reviewText: reviewText,
            timestamp: timestamp,
            photos: []  // Сюда добавим хеши фотографий после их загрузки
        };

        // Функция для загрузки фото с компрессией
        async function uploadCompressedPhoto(photo, fileName) {
            return new Promise((resolve, reject) => {
                new Compressor(photo, {
                    quality: 0.6,  // Сжатие до 60% качества
                    success(result) {
                        let formData = new FormData();
                        formData.append("file", result, fileName);  // Передаем оригинальное имя файла

                        fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
                            method: "POST",
                            headers: {
                                Authorization: `Bearer ${jwt}`
                            },
                            body: formData
                        })
                        .then(response => response.json())
                        .then(data => resolve({ cid: data.IpfsHash, name: fileName }))  // Возвращаем объект с CID и именем файла
                        .catch(error => reject(error));
                    },
                    error(err) {
                        reject(err);
                    }
                });
            });
        }

        // Сжатие и загрузка всех фотографий
        const uploadPromises = [];
        for (let i = 0; i < photos.length; i++) {
            const fileName = photos[i].name;  // Получаем оригинальное имя файла
            uploadPromises.push(uploadCompressedPhoto(photos[i], fileName));
        }

        // Ожидаем загрузки всех фотографий и добавляем их хеши в reviewData
        try {
            const photoData = await Promise.all(uploadPromises);  // Получаем массив объектов с CID и именами файлов
            reviewData.photos = photoData.map(photo => photo.cid);  // Добавляем только CID всех фотографий в JSON

            // Преобразуем объект в JSON
            const jsonBlob = new Blob([JSON.stringify(reviewData)], { type: "application/json" });

            // Создаем объект FormData для JSON-файла
            let formData = new FormData();
            formData.append("file", new File([jsonBlob], `${username}_review.json`));

            // Загрузка JSON-файла с отзывом
            const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${jwt}`
                },
                body: formData
            });

            if (response.ok) {
                const result = await response.json();
                console.log("Отзыв успешно загружен в IPFS:", result);

                // Скрываем индикатор загрузки и отображаем сообщение об успехе
                document.getElementById('loadingSpinner').classList.add('d-none');
                document.getElementById('closeModalBtn').classList.remove('d-none');
                
                // Очищаем сообщение о статусе и добавляем ссылки на фотографии, если они есть
                const statusMessage = document.getElementById('statusMessage');
                statusMessage.innerHTML = '<p class="text-success mt-2">Данные успешно загружены в IPFS!</p>';
                
                if (photoData.length > 0) {
                    const photoLinks = photoData.map(photo => 
                        `<a href="https://peach-convincing-gerbil-650.mypinata.cloud/ipfs/${photo.cid}" target="_blank">${photo.name}</a>`
                    ).join('<br>');
                    statusMessage.innerHTML += `<p>Загруженные фото:</p>${photoLinks}`;
                }
            } else {
                console.error("Ошибка загрузки отзыва:", await response.text());
            }
        } catch (error) {
            console.error("Ошибка загрузки фотографий или отзыва:", error);
        }

        // Инициализация модального окна
        const statusModal = new bootstrap.Modal(document.getElementById('statusModal'));
        statusModal.show();

        // Добавление обработчика события для перезагрузки страницы при закрытии модального окна
        document.getElementById('statusModal').addEventListener('hidden.bs.modal', function () {
            window.location.reload();
        });
    });
});
