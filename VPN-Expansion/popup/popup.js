document.addEventListener("DOMContentLoaded", () => {
    const toggleBtn = document.getElementById('toggleBtn'); // Кнопка включения/выключения VPN
    const statusText = document.getElementById('statusText'); // Текст статуса VPN
    const loginBtn = document.getElementById('loginBtn'); // Кнопка входа
    const registerBtn = document.getElementById('registerBtn'); // Кнопка регистрации
    const logoutBtn = document.getElementById('logoutBtn'); // Кнопка выхода
    const authSection = document.getElementById('authSection'); // Секция аутентификации
    const loginForm = document.getElementById('loginForm'); // Форма входа
    const submitLogin = document.getElementById('submitLogin'); // Кнопка отправки формы входа
    const backBtn = document.getElementById('backBtn'); // Кнопка "Назад" в форме входа
    const loadingElement = document.getElementById('loading'); // Элемент загрузки
    const userInfo = document.getElementById('userInfo'); // Секция информации о пользователе
    const userEmail = document.getElementById('userEmail'); // Поле для отображения email пользователя
    const paymentBtn = document.getElementById('paymentBtn'); // Кнопка оплаты
		
		const germanFlag = '\u{1F1E9}\u{1F1F2}';
		
		let isActive = false; // Статус VPN (включен/выключен по умолчанию)
    let isAuthenticated = false; // Статус аутентификации пользователя
    let email = ""; // Email аутентифицированного пользователя
		
		initUI();
		
		    // Обработчик клика по кнопке VPN
    toggleBtn.addEventListener('click', function () {
        // Проверяем аутентификацию перед включением VPN
        if (!isAuthenticated) {
            statusText.textContent = 'Пожалуйста, войдите в аккаунт перед использованием VPN';
            return;
        }

        // Блокируем кнопку на время обработки запроса
        toggleBtn.disabled = true;
        statusText.textContent = isActive ? 'Отключаем...' : 'Подключаем...';

        // Отправляем сообщение в фоновый скрипт для переключения VPN
        chrome.runtime.sendMessage({ action: "toggle" }, () => {
            // Разблокируем кнопку после завершения операции
            toggleBtn.disabled = false;
            loadingElement.style.display = 'none';
        });
    });

    // Показать форму логина
    loginBtn.addEventListener("click", () => {
        buttonColumn.style.display = "none";
        loginForm.style.display = "flex";
        statusText.textContent = "Пожалуйста введите логин и пароль, использованные при регистрации";
    });

    // Вернуться назад
    backBtn.addEventListener("click", () => {
        loginForm.style.display = "none";
        buttonColumn.style.display = "flex";
        statusText.textContent = "Не выполнен вход в аккаунт";
    });

    // Отправка формы логина
    submitLogin.addEventListener("click", async () => {
        const email = "sergdorn@inbox.ru";
				const password = "1245678Qq";
				/*
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        
        if (!email || !password) {
            statusText.textContent = 'Пожалуйста, заполните все поля';
            return;
        }
        */
				statusText.textContent = 'Входим в аккаунт...';

				// Отправляем данные для аутентификации в фоновый скрипт 
				chrome.runtime.sendMessage({
						action: "authenticate",
						credentials: { email, password }
				}, (response) => {
						loadingElement.style.display = 'none';

						if (response && response.success) {
								// Успешная аутентификация
								isAuthenticated = true;
								userEmail.textContent = response.email || email;
								userInfo.style.display = 'block';
								document.getElementById('loginForm').style.display = 'none';
								document.getElementById('buttonColumn').style.display = 'flex';
								authSection.style.display = 'none';

								// Обновляем статус VPN после успешной авторизации
								chrome.runtime.sendMessage({ action: "getStatus" }, (statusResponse) => {
										if (statusResponse) {
												isActive = statusResponse.status;
												updateUI(isActive);
										}
								});
						} else {

								// Ошибка аутентификации
								statusText.textContent = 'Входим в аккаунт...';
						}
				});
    });
		
		// Слушаем изменения в хранилище Chrome (для статуса VPN)
    chrome.storage.onChanged.addListener(function (changes) {
        if (changes.vpnStatus) {
            // Обновляем статус VPN при изменении
            isActive = changes.vpnStatus.newValue;
            updateUI(isActive);
        }
        if (changes.authState) {
            // Обновляем состояние аутентификации при изменении
            isAuthenticated = changes.authState.newValue.isAuthenticated;
            email = changes.authState.newValue.email;
            if (isAuthenticated) {
                userEmail.textContent = email;
                userInfo.style.display = 'block';
                authSection.style.display = 'none';
                loginForm.style.display = 'none';
            }
        }
    });

    // (опционально) Кнопка регистрации
    registerBtn.addEventListener("click", () => {
        window.open("https://barbarisvpn.online/registration", "_blank");
    });
		
		// Обработчик клика по кнопке оплаты
    paymentBtn.addEventListener('click', function () {
        chrome.tabs.create({ url: 'https://barbarisvpn.online' });
    });

    // Обработчик клика по кнопке выхода
    logoutBtn.addEventListener('click', function () {
        // Блокируем кнопку на время обработки запроса
        toggleBtn.disabled = true;
        loadingElement.style.display = 'block';
        loadingElement.textContent = 'Выход из аккаунта...';

        // Отправляем сообщение в фоновый скрипт для выхода
        chrome.runtime.sendMessage({ action: "logout" }, function (response) {
            if (response.success) {
                // Обновляем состояние и UI после успешного выхода
                isAuthenticated = false;
                email = "";
                isActive = false;
                updateUI(isActive);

                userInfo.style.display = 'none';
                authSection.style.display = 'block';
                loginForm.style.display = 'none';
            }

            // Разблокируем кнопку после завершения операции
            toggleBtn.disabled = false;
            loadingElement.style.display = 'none';
        });
    });
		
		// Функция инициализации пользовательского интерфейса
    function initUI() {
        // Запрашиваем текущий статус VPN у фонового скрипта
        chrome.runtime.sendMessage({ action: "getStatus" }, function (response) {
            if (chrome.runtime.lastError) {
                // Если ошибка - повторяем запрос через 200 мс
                setTimeout(initUI, 200);
                return;
            }
            isActive = response.status;
            updateUI(isActive);
        });

        // Проверяем статус аутентификации при загрузке
        chrome.runtime.sendMessage({ action: "checkAuth" }, function (response) {
            if (response.authenticated) {
                // Пользователь аутентифицирован - показываем его информацию
                isAuthenticated = true;
                email = response.email;
                userEmail.textContent = email;
                userInfo.style.display = 'block';
                authSection.style.display = 'none';
                loginForm.style.display = 'none';
            } else {
                // Пользователь не аутентифицирован - показываем секцию входа
                isAuthenticated = false;
                userInfo.style.display = 'none';
                authSection.style.display = 'block';
            }
        });
    }

    // Функция обновления интерфейса в зависимости от статуса VPN
    function updateUI(isActive) {
        if (isActive && isAuthenticated) {
            // VPN включен
            toggleBtn.textContent = 'Отключиться';
            toggleBtn.className = 'toggle-btn on';
            statusText.textContent = 'Статус: Активен<p>Выполнен вход в аккаунт<p>Сервер: Germany' + germanFlag;
            statusText.style.color = '#4CAF50'; // Зеленый цвет
        } else if (! isActive && isAuthenticated) {
						toggleBtn.textContent = 'Подключиться';
						toggleBtn.className = 'toggle-btn off';
						statusText.textContent = 'Статус: Отключён<p>Выполнен вход в аккаунт<p>Сервер: Germany' + germanFlag;
						statusText.style.color = '#ffffff'; // белый цвет
				}
        loadingElement.style.display = 'none'; // Скрываем индикатор загрузки
    }
});
