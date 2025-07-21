document.addEventListener('DOMContentLoaded', function () {
    const toggleBtn = document.getElementById('toggleBtn');
    const statusText = document.getElementById('statusText');
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const authSection = document.getElementById('authSection');
    const loginForm = document.getElementById('loginForm');
    const submitLogin = document.getElementById('submitLogin');
    const backBtn = document.getElementById('backBtn');
    const loadingElement = document.getElementById('loading');
    const userInfo = document.getElementById('userInfo');
    const userEmail = document.getElementById('userEmail');

    let isActive = false;
    //let isAuthenticated = false;
    let isAuthenticated = true;
    const email = "sergdorn@inbox.ru";
    const password = "jnXJ_dagtX8ce_hbOwad";

    // Инициализация UI
    initUI();

    // Обработчик кнопки VPN
    toggleBtn.addEventListener('click', function () {
        if (!isAuthenticated) {
            alert('Пожалуйста, войдите в аккаунт перед использованием VPN');
            return;
        }

        toggleBtn.disabled = true;
        loadingElement.style.display = 'block';
        loadingElement.textContent = isActive ? 'Отключаем...' : 'Подключаем...';

        chrome.runtime.sendMessage({ action: "toggle" }, () => {
            toggleBtn.disabled = false;
            loadingElement.style.display = 'none';
        });
    });

    // Обработчик кнопки входа
    loginBtn.addEventListener('click', function () {
        authSection.style.display = 'none';
        loginForm.style.display = 'block';
    });

    // Обработчик кнопки регистрации
    registerBtn.addEventListener('click', function () {
        chrome.tabs.create({ url: 'https://barbarisvpn.online/registration' });
    });

    // Обработчик кнопки "Назад"
    backBtn.addEventListener('click', function () {
        loginForm.style.display = 'none';
        authSection.style.display = 'block';
    });

    // Обработчик отправки формы
   
    submitLogin.addEventListener('click', function () {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        if (!email || !password) {
            alert('Пожалуйста, заполните все поля');
            return;
        }

        loadingElement.style.display = 'block';
        loadingElement.textContent = 'Входим в аккаунт...';

        chrome.runtime.sendMessage({
            action: "authenticate",
            credentials: { email, password }
        }, (response) => {
            loadingElement.style.display = 'none';

            if (response.success) {
                isAuthenticated = true;
                userEmail.textContent = email;
                userInfo.style.display = 'block';
                loginForm.style.display = 'none';
                authSection.style.display = 'none';
                alert('Авторизация успешна!');
            } else {
                alert('Ошибка авторизации: ' + response.error);
            }
        });
    });

    // Слушаем изменения статуса VPN
    chrome.storage.onChanged.addListener(function (changes) {
        if (changes.vpnStatus) {
            isActive = changes.vpnStatus.newValue;
            updateUI(isActive);
        }
    });

    // Инициализация UI
    function initUI() {
        chrome.runtime.sendMessage({ action: "getStatus" }, function (response) {
            if (chrome.runtime.lastError) {
                setTimeout(initUI, 200);
                return;
            }
            isActive = response.status;
            updateUI(isActive);
        });

        // Проверяем аутентификацию при загрузке
        chrome.runtime.sendMessage({ action: "checkAuth" }, function (response) {
            if (response.authenticated) {
                isAuthenticated = true;
                userEmail.textContent = response.email;
                userInfo.style.display = 'block';
                authSection.style.display = 'none';
            }
        });
    }

    // Обновление UI
    function updateUI(isActive) {
        if (isActive) {
            toggleBtn.textContent = 'Отключиться';
            toggleBtn.className = 'toggle-btn on';
            statusText.textContent = 'Статус: Активен';
            statusText.style.color = '#4CAF50';
        } else {
            toggleBtn.textContent = 'Подключиться';
            toggleBtn.className = 'toggle-btn off';
            statusText.textContent = 'Статус: Отключен';
            statusText.style.color = '#f44336';
        }
        loadingElement.style.display = 'none';
    }
});