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

    let isActive = false;

    // Инициализация UI
    initUI();

    // Обработчик кнопки VPN
    toggleBtn.addEventListener('click', function () {
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

        // Здесь будет код для авторизации через API
        setTimeout(() => {
            loadingElement.style.display = 'none';
            alert('Авторизация успешна!');
            loginForm.style.display = 'none';
            authSection.style.display = 'block';
        }, 1500);
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