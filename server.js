require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const WechatAPI = require('wechat-api');
const winston = require('winston');
const rateLimit = require("express-rate-limit");

const app = express();
const port = process.env.PORT || 3000;

// 日志配置
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'error' : 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'popmart-service' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

// 调试日志函数
const debugLog = process.env.NODE_ENV !== 'production'
  ? (...args) => logger.debug(...args)
  : () => {};

// 微信 API 配置
const wechatConfig = {
  appId: process.env.WECHAT_APP_ID,
  appSecret: process.env.WECHAT_APP_SECRET
};
const wechatApi = new WechatAPI(wechatConfig.appId, wechatConfig.appSecret);

// Popmart API 配置
const popmartApiBaseUrl = process.env.POPMART_API_BASE_URL;
const popmartApiKey = process.env.POPMART_API_KEY;

// 错误处理函数
function handleError(res, error, statusCode = 500) {
  logger.error('Error occurred:', { error: error.message, stack: error.stack });
  res.status(statusCode).json({
    code: statusCode,
    message: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : error.message
  });
}

// 中间件
app.use(cors());
app.use(express.json());

// 速率限制
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // 每个 IP 限制 100 个请求
});
app.use("/api/", apiLimiter);

// 认证中间件
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// API 路由

// 获取微信登录二维码
app.get('/api/wx-login/qrcode', async (req, res) => {
  try {
    const qrcodeUrl = await wechatApi.getAuthorizeURL(process.env.WECHAT_REDIRECT_URI, 'state', 'snsapi_userinfo');
    res.json({ code: 200, data: { qrcode: qrcodeUrl } });
  } catch (error) {
    handleError(res, error);
  }
});

// 微信登录回调
app.get('/api/wx-login/callback', async (req, res) => {
  try {
    const code = req.query.code;
    const result = await wechatApi.getAccessToken(code);
    const userInfo = await wechatApi.getUser(result.data.openid);

    // 创建 JWT token
    const token = jwt.sign({ id: userInfo.openid }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.json({ code: 200, data: { token, userInfo } });
  } catch (error) {
    handleError(res, error);
  }
});

// 获取新品列表
app.get('/api/goods/list', authenticateToken, async (req, res) => {
  try {
    const response = await axios.get(`${popmartApiBaseUrl}/products`, {
      headers: { 'Authorization': `Bearer ${popmartApiKey}` },
      params: req.query // 传递查询参数，如页码、每页数量等
    });
    res.json({ code: 200, data: response.data });
  } catch (error) {
    handleError(res, error);
  }
});

// 获取产品详情
app.get('/api/goods/detail/:id', authenticateToken, async (req, res) => {
  try {
    const productId = req.params.id;
    const response = await axios.get(`${popmartApiBaseUrl}/products/${productId}`, {
      headers: { 'Authorization': `Bearer ${popmartApiKey}` }
    });
    res.json({ code: 200, data: response.data });
  } catch (error) {
    handleError(res, error);
  }
});

// 创建订单
app.post('/api/order/create', authenticateToken, async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const response = await axios.post(`${popmartApiBaseUrl}/orders`, {
      productId,
      quantity,
      userId: req.user.id
    }, {
      headers: { 'Authorization': `Bearer ${popmartApiKey}` }
    });
    res.json({ code: 200, data: response.data });
  } catch (error) {
    handleError(res, error);
  }
});

// 获取订单状态
app.get('/api/order/status/:orderId', authenticateToken, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const response = await axios.get(`${popmartApiBaseUrl}/orders/${orderId}`, {
      headers: { 'Authorization': `Bearer ${popmartApiKey}` }
    });
    res.json({ code: 200, data: response.data });
  } catch (error) {
    handleError(res, error);
  }
});

// 获取微信支付参数
app.post('/api/payment/wechat', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.body;
    // 这里需要根据微信支付 API 文档实现具体逻辑
    const payParams = await wechatApi.getPayParams({
      body: 'Popmart商品',
      out_trade_no: orderId,
      total_fee: 1, // 总金额（分）
      spbill_create_ip: req.ip,
      notify_url: process.env.WECHAT_PAY_NOTIFY_URL,
      trade_type: 'JSAPI',
      openid: req.user.id
    });
    res.json({ code: 200, data: payParams });
  } catch (error) {
    handleError(res, error);
  }
});

// 微信支付回调
app.post('/api/payment/wechat/notify', (req, res) => {
  // 处理微信支付回调，更新订单状态等
  // 这里需要根据微信支付文档实现具体逻辑
  try {
    // 验证签名等操作...
    // 更新订单状态...
    logger.info('Payment notification received');
    res.send('SUCCESS');
  } catch (error) {
    logger.error('Payment notification error:', error);
    res.status(500).send('FAIL');
  }
});

// 全局错误处理中间件
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', { error: err.message, stack: err.stack });
  handleError(res, err);
});

// 启动服务器
app.listen(port, () => {
  logger.info(`Server running at http://localhost:${port}`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  app.close(() => {
    logger.info('HTTP server closed');
  });
});