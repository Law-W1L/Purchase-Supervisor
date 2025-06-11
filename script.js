// Configuration
const CONFIG = {
    checkInterval: 5000, // Check interval (milliseconds)
    popmartBaseUrl: 'http://localhost:3000', // Points to our local proxy server
    apiEndpoints: {
        // All API requests will be forwarded through our local proxy server
        loginQrcode: '/proxy/wx-login/qrcode', // Get WeChat login QR code
        loginCallback: '/proxy/wx-login/callback', // WeChat login callback (called by WeChat, not directly by frontend)
        loginStatus: '/proxy/wx-login/status', // Check login status
        newProducts: '/proxy/api/goods/list', // Product list
        productDetail: '/proxy/api/goods/detail', // Product details
        purchase: '/proxy/api/order/create', // Create order
        wechatPay: '/proxy/api/payment/wechat' // WeChat payment
    },
    emailjs: {
        serviceID: 'service_uicejdr',
        templateID: 'template_gegvzf2',
        userID: '5Y6NeYiv1iO0CSCoO'
    }
};

// State management
let state = {
    isMonitoring: false,
    monitoredProducts: new Set(),
    userCredentials: null,
    notificationEnabled: true,
    autoPurchase: true,
    emailEnabled: true,
    emailAddress: '992557645@qq.com',
    lastCheckTime: null,
    token: null,
    loginCheckInterval: null,
    productCheckInterval: null
};

// DOM elements
const elements = {
    startMonitor: document.getElementById('startMonitor'),
    stopMonitor: document.getElementById('stopMonitor'),
    status: document.getElementById('status'),
    monitoredProducts: document.getElementById('monitoredProducts'),
    loginArea: document.getElementById('login-area'),
    emailForm: document.getElementById('emailForm'),
    enableNotification: document.getElementById('enableNotification'),
    enableEmail: document.getElementById('enableEmail'),
    autoPurchase: document.getElementById('autoPurchase'),
    notification: document.getElementById('notification'),
    monitorStatus: document.getElementById('monitor-status')
};

// Initialization
function init() {
    loadSavedSettings();
    setupEventListeners();
    checkNotificationPermission();
    initEmailJS();
    // Automatically start login process when page loads
    getLoginQRCode();
}

// Get Login QR Code
async function getLoginQRCode() {
    try {
        const response = await fetch(`${CONFIG.popmartBaseUrl}${CONFIG.apiEndpoints.loginQrcode}`);
        const result = await response.json();

        if (result.code === 200) {
            const qrcodeUrl = result.data.qrcode;
            elements.loginArea.innerHTML = `
                <div class="qrcode-container">
                    <img id="qrcode-image" src="${qrcodeUrl}" alt="微信登录二维码" />
                    <p id="qrcode-text">请使用手机微信扫描二维码登录</p>
                </div>
            `;

            startLoginStatusCheck();
        } else {
            console.error('获取二维码失败:', result.message);
        }
    } catch (error) {
        console.error('获取二维码出错:', error);
    }
}

// Initialize EmailJS
function initEmailJS() {
    emailjs.init(CONFIG.emailjs.userID);
}

// Load saved settings
function loadSavedSettings() {
    const savedSettings = localStorage.getItem('popmartSettings');
    if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        state.userCredentials = settings.credentials;
        state.notificationEnabled = settings.notificationEnabled;
        state.autoPurchase = settings.autoPurchase;
        state.emailEnabled = settings.emailEnabled;
        state.emailAddress = settings.emailAddress;

        // Update UI
        elements.enableNotification.checked = state.notificationEnabled;
        elements.autoPurchase.checked = state.autoPurchase;
        elements.enableEmail.checked = state.emailEnabled;
        document.getElementById('email').value = state.emailAddress;
    }
}

// Set event listeners
function setupEventListeners() {
    elements.startMonitor.addEventListener('click', startMonitoring);
    elements.stopMonitor.addEventListener('click', stopMonitoring);
    elements.emailForm.addEventListener('submit', saveEmailSettings);
    elements.enableNotification.addEventListener('change', toggleNotification);
    elements.enableEmail.addEventListener('change', toggleEmail);
    elements.autoPurchase.addEventListener('change', toggleAutoPurchase);
    elements.loginArea.addEventListener('click', getLoginQRCode);
}

// Check notification permission
async function checkNotificationPermission() {
    if (!("Notification" in window)) {
        showNotification("Your browser does not support notifications", true);
        state.notificationEnabled = false;
        elements.enableNotification.checked = false;
        return;
    }

    if (Notification.permission === "granted") {
        return;
    }

    if (Notification.permission !== "denied") {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
            showNotification("Please allow notifications to receive product update alerts", true);
            state.notificationEnabled = false;
            elements.enableNotification.checked = false;
        }
    }
}

// Start monitoring
function startMonitoring() {
    if (!state.token) {
        showNotification("Please login first", true);
        return;
    }

    state.isMonitoring = true;
    elements.startMonitor.disabled = true;
    elements.stopMonitor.disabled = false;
    elements.status.textContent = "Monitoring...";

    // Start periodic product checks
    startProductMonitoring();
}

// Stop monitoring
function stopMonitoring() {
    state.isMonitoring = false;
    elements.startMonitor.disabled = false;
    elements.stopMonitor.disabled = true;
    elements.status.textContent = "Stopped";
    if (state.productCheckInterval) {
        clearInterval(state.productCheckInterval);
    }
}

// Start product monitoring
function startProductMonitoring() {
    if (state.productCheckInterval) {
        clearInterval(state.productCheckInterval);
    }

    state.isMonitoring = true;
    elements.monitorStatus.textContent = "正在监控新品...";

    state.productCheckInterval = setInterval(async () => {
        try {
            const response = await fetch(`${CONFIG.popmartBaseUrl}${CONFIG.apiEndpoints.newProducts}`, {
                headers: {
                    'Authorization': `Bearer ${state.token}`
                }
            });
            const result = await response.json();

            if (result.code === 200) {
                const products = result.data.list;

                // Get products from the last 24 hours
                const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                const newProducts = products.filter(product =>
                    new Date(product.releaseTime) > oneDayAgo &&
                    !state.monitoredProducts.has(product.id)
                );

                if (newProducts.length > 0) {
                    // Found new products, handle them
                    newProducts.forEach(handleNewProduct);
                }

                // Update status display
                elements.monitorStatus.textContent = `监控中... (上次检查: ${new Date().toLocaleTimeString()})`;
            }
        } catch (error) {
            console.error('检查新品错误:', error);
            elements.monitorStatus.textContent = "监控出错，正在重试...";
        }
    }, CONFIG.checkInterval);
}

// Handle new product
async function handleNewProduct(product) {
    state.monitoredProducts.add(product.id);
    updateProductList();

    if (state.notificationEnabled) {
        showNotification(`Found new product: ${product.name} - ¥${product.price}`);
    }

    if (state.emailEnabled) {
        await sendEmailNotification(product);
    }

    if (state.autoPurchase) {
        await attemptPurchase(product);
    }
}

// Attempt purchase
async function attemptPurchase(product) {
    try {
        showNotification(`Attempting to purchase: ${product.name}`, false);

        // Create order (via proxy)
        const orderResponse = await fetch(`${CONFIG.popmartBaseUrl}${CONFIG.apiEndpoints.purchase}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`,
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                goodsId: product.id,
                quantity: 1,
                paymentMethod: 'wechat'
            })
        });

        const orderResult = await orderResponse.json();

        if (orderResult.code === 200) {
            // Redirect to payment page
            window.location.href = `${CONFIG.popmartBaseUrl}/payment?orderId=${orderResult.data.orderId}`;
        } else {
            throw new Error(orderResult.message || 'Failed to create order');
        }
    } catch (error) {
        console.error('Error purchasing product:', error);
        showNotification("Error purchasing product: " + error.message, true);
    }
}

// Update product list
function updateProductList() {
    elements.monitoredProducts.innerHTML = Array.from(state.monitoredProducts)
        .map(productId => {
            const product = { id: productId, name: 'Unknown', price: 'N/A' }; // You might want to store more info about products
            return `
                <li class="product-item">
                    <div class="product-name">${product.name}</div>
                    <div class="product-price">¥${product.price}</div>
                    <div class="product-time">Found time: ${new Date().toLocaleString()}</div>
                    <a href="#" onclick="event.preventDefault(); attemptPurchase({ id: '${product.id}', name: '${product.name}', price: '${product.price}' })" class="purchase-link">Purchase Now</a>
                </li>
            `;
        })
        .join('');
}

// Save email settings
function saveEmailSettings(event) {
    event.preventDefault();
    const email = document.getElementById('email').value;
    state.emailAddress = email;
    saveSettings();
    showNotification("Email settings saved");
}

// Toggle notification
function toggleNotification(event) {
    state.notificationEnabled = event.target.checked;
    saveSettings();
}

// Toggle email notification
function toggleEmail(event) {
    state.emailEnabled = event.target.checked;
    saveSettings();
}

// Toggle automatic purchase
function toggleAutoPurchase(event) {
    state.autoPurchase = event.target.checked;
    saveSettings();
}

// Send email notification
// Send email notification
async function sendEmailNotification(product) {
    if (!state.emailEnabled) return;

    try {
        const templateParams = {
            to_email: state.emailAddress,
            product_name: product.name,
            product_price: product.price,
            product_time: new Date().toLocaleString(), // 使用当前时间作为发现产品的时间
            product_url: `${CONFIG.popmartBaseUrl}/product/${product.id}` // 假设这是产品详情页的URL
        };

        await emailjs.send(
            CONFIG.emailjs.serviceID,
            CONFIG.emailjs.templateID,
            templateParams
        );

        console.log('Email notification sent successfully');
    } catch (error) {
        console.error('Failed to send email notification:', error);
        showNotification("Failed to send email notification: " + error.message, true);
    }
}