# Popmart Product Monitor and Purchase Automation

This is a full-stack web application that helps users monitor Popmart's new product releases and automate the purchase process. It includes both a frontend interface and a backend server with API integration.

## Features
- Real-time monitoring of new Popmart products
- WeChat login integration
- Automatic order creation for new products
- WeChat payment integration
- User-friendly interface
- Logging and error handling
- Rate limiting to prevent API abuse

## Prerequisites
Before you begin, ensure you have met the following requirements:
- Node.js (v12 or later)
- npm (usually comes with Node.js)
- Modern web browser (Chrome, Firefox, Edge recommended)
- WeChat Developer Account
- Popmart API access (you need to contact Popmart for this)
- Internet connection
- Popmart account

## Setup
1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/popmart-monitor.git
   cd popmart-monitor
2.Install dependencies
npm install

3.Create a .env file in the root directory and add the following:
PORT=3000
NODE_ENV=development
JWT_SECRET=your_very_secret_key_here
WECHAT_APP_ID=your_wechat_app_id
WECHAT_APP_SECRET=your_wechat_app_secret
WECHAT_REDIRECT_URI=http://localhost:3000/api/wx-login/callback
WECHAT_PAY_NOTIFY_URL=http://localhost:3000/api/payment/wechat/notify
POPMART_API_BASE_URL=https://api.popmart.com
POPMART_API_KEY=your_popmart_api_key

Replace the placeholder values with your actual credentials

Usage
1.Start the backend server:
npm start

2.Open the frontend:

Option 1: Using a local server (recommended)
npx http-server
Then open http://localhost:8080 in your browser.

Option 2: Direct file opening
Simply double-click index.html or drag it into your browser.

3.When you first open the application, you'll see a QR code for WeChat login.

4.After logging in, you can:
Configure email notifications (optional)
Set up product monitoring preferences
Configure notification settings
Enable/disable auto-purchase feature

5.The application will automatically notify you when new products are available.

6.Click the purchase button to automatically create an order and proceed to payment.
API Endpoints

GET /api/wx-login/qrcode: Get WeChat login QR code

GET /api/wx-login/callback: WeChat login callback

GET /api/goods/list: Get list of new products (requires authentication)

GET /api/goods/detail/:id: Get product details (requires authentication)

POST /api/order/create: Create a new order (requires authentication)

GET /api/order/status/:orderId: Get order status (requires authentication)

POST /api/payment/wechat: Get WeChat payment parameters (requires authentication)

POST /api/payment/wechat/notify: WeChat payment notification callback
Security

This application implements several security measures:

JWT for authentication

Rate limiting to prevent API abuse

CORS for cross-origin resource sharing

Environment variables for sensitive information

Logging

Logs are written to error.log and combined.log files. In development mode, logs are also output to the console.

Contributing

Contributions to this project are welcome. Please ensure to update tests as appropriate.

License
