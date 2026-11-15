/* SMT 共享数据 + 模块（四页共用，v4.0 CRAP 重构） */
var cart = [];
var CURRENCY = 'SGD';
var selectedPay = 'paynow';
var GST_RATE = 0.09;

/* 客服联系方式 —— 全站唯一来源。
   真实邮箱/WhatsApp 由品牌方提供后，只改这里，并把 isDemo 改为 false。
   页面上会在 isDemo=true 时自动追加「占位」提示，避免把演示地址当成真客服。 */
var SUPPORT_CONTACT = {
  email: 'support@example.com',
  whatsapp: '+65 0000 0000',
  isDemo: true
};

var PAYMENT_METHODS = [
  { id: 'paynow',     name: 'PayNow',     requiresCard: false, logo: 'PayNow', color: '#1D78CB' },
  { id: 'visa',       name: 'Visa',       requiresCard: true,  logo: 'VISA',   color: '#1A1F71' },
  { id: 'mastercard', name: 'Mastercard', requiresCard: true,  logo: 'MC',     color: '#EB001B' },
  { id: 'paypal',     name: 'PayPal',     requiresCard: false, logo: 'PayPal', color: '#003087' },
  { id: 'alipay',     name: 'Alipay',     requiresCard: false, logo: '支付',   color: '#1677FF' },
  { id: 'wechat',     name: 'WeChat Pay', requiresCard: false, logo: '微',     color: '#07C160' },
  { id: 'unionpay',   name: 'UnionPay',   requiresCard: true,  logo: '銀聯',   color: '#D10429' }
]
var PRODUCTS = {
  'nano-active-peptide': {
    id: 'nano-active-peptide',
    name: { en: 'Nano Active Peptide', zh: '纳米活性肽', tw: '奈米活性胜肽' },
    tiers: [
      { id: 'trial',    name: { en: 'Trial Pack', zh: '试用装', tw: '試用裝' },      desc: { en: '10-day starter', zh: '10 天入门', tw: '10 天入門' },  img: 'assets/products/tier-trial.jpg',    price: 38.00,  originalPrice: null },
      { id: '1-month',  name: { en: '1-Month Supply', zh: '1 个月用量', tw: '1 個月用量' }, desc: { en: '30-day supply', zh: '30 天用量', tw: '30 天用量' }, img: 'assets/products/tier-1month.jpg',  price: 128.00, originalPrice: null },
      { id: '3-month',  name: { en: '3-Month Supply', zh: '3 个月用量', tw: '3 個月用量' }, desc: { en: '90-day supply', zh: '90 天用量', tw: '90 天用量' }, img: 'assets/products/tier-3month.jpg',  price: 348.00, originalPrice: 384.00 }
    ]
  }
}
var PaymentService = {
  createOrder: function (orderData) {
    return new Promise(function (resolve) {
      setTimeout(function () {
        resolve({ orderId: 'SMT-' + Date.now(), amount: orderData.amount, currency: CURRENCY, status: 'pending' });
      }, 500);
    });
  },
  initiatePayment: function (method, orderId) {
    return new Promise(function (resolve) {
      setTimeout(function () {
        var type = (method === 'paynow') ? 'qr' : ((method === 'alipay' || method === 'wechat' || method === 'paypal') ? 'redirect' : 'token');
        resolve({ type: type, orderId: orderId });
      }, 800);
    });
  },
  checkPaymentStatus: function (orderId) {
    return new Promise(function (resolve) {
      setTimeout(function () {
        resolve({ status: 'success', transactionId: 'txn_' + String(orderId).slice(-6), orderId: orderId });
      }, 1500);
    });
  }
}

/* SMT 共享模块：i18n 语言切换 + 购物车/结账（四页共用，v4.0 CRAP 重构） */
var SITE_LANGS = ['en', 'zh', 'tw'];
var currentLang = 'en';
function t(key) {
  var d = siteI18n[key];
  if (!d) return key;
  return (d[currentLang] !== undefined && d[currentLang] !== '') ? d[currentLang] : d.en;
}
var I18N_ATTR_TARGETS = [
  { sel: '[data-i18n]',      attr: null,          key: 'data-i18n' },
  { sel: '[data-i18n-aria]', attr: 'aria-label',  key: 'data-i18n-aria' },
  { sel: '[data-i18n-alt]',  attr: 'alt',         key: 'data-i18n-alt' },
  { sel: '[data-i18n-ph]',   attr: 'placeholder', key: 'data-i18n-ph' }
];

function applyAttrTranslations() {
  I18N_ATTR_TARGETS.forEach(function (cfg) {
    document.querySelectorAll(cfg.sel).forEach(function (el) {
      var src = el.getAttribute(cfg.key);
      var txt = t(src);
      if (!txt || txt === src) return;
      if (cfg.attr) el.setAttribute(cfg.attr, txt);
      else el.textContent = txt;
    });
  });
}

function applyMetaTranslations() {
  var pairs = [
    ['meta[name="description"]', 'meta.desc'],
    ['meta[property="og:title"]', 'og.title'],
    ['meta[property="og:description"]', 'og.desc']
  ];
  pairs.forEach(function (pair) {
    var el = document.querySelector(pair[0]);
    if (el) el.setAttribute('content', t(pair[1]));
  });
}

function applyLangButtons(lang) {
  document.querySelectorAll('.lang-btn').forEach(function (b) {
    var active = b.getAttribute('data-lang') === lang;
    b.classList.toggle('lang-btn--active', active);
    b.setAttribute('aria-pressed', String(active));
  });
}

function refreshDynamicContent() {
  ['renderCart', 'renderOrderSummary', 'renderPayMethods', 'updatePayBtn', 'renderOrderPage']
    .forEach(function (name) {
      if (typeof window[name] === 'function') window[name]();
    });
  if (window.onLanguageApplied) window.onLanguageApplied();
}

function applyLanguage(lang) {
  if (SITE_LANGS.indexOf(lang) === -1) lang = 'en';
  currentLang = lang;
  try { localStorage.setItem('smt-lang', lang); } catch (e) {}

  document.documentElement.lang = (lang === 'tw') ? 'zh-Hant' : (lang === 'zh') ? 'zh-Hans' : 'en';
  document.title = t(typeof PAGE_TITLE_KEY !== 'undefined' ? PAGE_TITLE_KEY : 'meta.title');

  applyAttrTranslations();
  applyMetaTranslations();
  applyLangButtons(lang);
  refreshDynamicContent();

  if (window.ScrollTrigger) {
    setTimeout(function () { window.ScrollTrigger.refresh(); }, 60);
  }
}
function fmtMoney(n) { return CURRENCY + ' ' + n.toFixed(2); }
function getTier(tierId) {
  var product = PRODUCTS['nano-active-peptide'];
  if (!product) return null;
  for (var i = 0; i < product.tiers.length; i++) {
    if (product.tiers[i].id === tierId) return product.tiers[i];
  }
  return null;
}
function cartTotals() {
  var subtotal = cart.reduce(function (sum, item) {
    var tier = getTier(item.tierId);
    return sum + (tier ? tier.price : 0) * item.quantity;
  }, 0);
  var gst = subtotal * GST_RATE;
  return { subtotal: subtotal, gst: gst, total: subtotal + gst };
}
function updateCartCount() {
  var badge = document.getElementById('cart-count');
  if (!badge) return;
  var count = cart.reduce(function (sum, item) { return sum + item.quantity; }, 0);
  badge.textContent = count > 0 ? String(count) : '';
}
function productLabel(product) {
  return product.name[currentLang] || product.name.en;
}

function tierLabel(tier) {
  return tier.name[currentLang] || tier.name.en;
}

function cartItemHtml(item, index) {
  var tier = getTier(item.tierId);
  if (!tier) return '';
  var product = PRODUCTS['nano-active-peptide'];
  var lineTotal = tier.price * item.quantity;
  return '<div class="cart-item">'
    + '<div class="cart-item-thumb"><img src="' + tier.img + '" alt="' + product.name.en + '" loading="lazy"></div>'
    + '<div class="cart-item-info">'
    +   '<div class="cart-item-name">' + productLabel(product) + '</div>'
    +   '<div class="cart-item-tier">' + tierLabel(tier) + '</div>'
    +   '<div class="cart-item-bottom">'
    +     '<div class="qty-stepper">'
    +       '<button type="button" class="qty-btn" onclick="changeCartItemQty(' + index + ', -1)" aria-label="' + t('cart.decrease') + '">−</button>'
    +       '<span class="qty-value">' + item.quantity + '</span>'
    +       '<button type="button" class="qty-btn" onclick="changeCartItemQty(' + index + ', 1)" aria-label="' + t('cart.increase') + '">+</button>'
    +     '</div>'
    +     '<div class="cart-item-price">' + fmtMoney(lineTotal) + '</div>'
    +   '</div>'
    +   '<button type="button" class="cart-item-remove" onclick="removeCartItem(' + index + ')">' + t('cart.remove') + '</button>'
    + '</div>'
    + '</div>';
}

function renderCart() {
  var listEl = document.getElementById('cart-items');
  var emptyEl = document.getElementById('cart-empty');
  var footerEl = document.getElementById('cart-footer');
  if (!listEl || !emptyEl || !footerEl) return;

  var isEmpty = cart.length === 0;
  emptyEl.hidden = !isEmpty;
  footerEl.hidden = isEmpty;
  if (isEmpty) {
    listEl.innerHTML = '';
    return;
  }

  listEl.innerHTML = cart.map(cartItemHtml).join('');
  updateTotals();
  if (typeof renderInviteRow === 'function') renderInviteRow();
}
function updateTotals() {
  var totals = cartTotals();
  var subEl = document.getElementById('cart-subtotal');
  var gstEl = document.getElementById('cart-gst');
  var totalEl = document.getElementById('cart-total');
  if (subEl) subEl.textContent = fmtMoney(totals.subtotal);
  if (gstEl) gstEl.textContent = fmtMoney(totals.gst);
  if (totalEl) totalEl.textContent = fmtMoney(totals.total);
  updatePayBtn();
}
function changeCartItemQty(index, delta) {
  if (!cart[index]) return;
  cart[index].quantity += delta;
  if (cart[index].quantity <= 0) cart.splice(index, 1);
  renderCart();
  updateCartCount();
}
function removeCartItem(index) {
  cart.splice(index, 1);
  renderCart();
  updateCartCount();
}
function showToast(msg) {
  var el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2200);
}
function addToCart(tierId) {
  var tier = getTier(tierId);
  if (!tier) return;
  var existing = null;
  for (var i = 0; i < cart.length; i++) {
    if (cart[i].tierId === tierId) { existing = cart[i]; break; }
  }
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ productId: 'nano-active-peptide', tierId: tierId, quantity: 1 });
  }
  renderCart();
  updateCartCount();
  openCart();
  showToast(t('cart.added'));
}
function openCart() {
  var overlay = document.getElementById('cart-overlay');
  var drawer = document.getElementById('cart-drawer');
  if (overlay) overlay.classList.add('open');
  if (drawer) drawer.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeCart() {
  var overlay = document.getElementById('cart-overlay');
  var drawer = document.getElementById('cart-drawer');
  if (overlay) overlay.classList.remove('open');
  if (drawer) drawer.classList.remove('open');
  document.body.style.overflow = '';
}
function renderPayMethods() {
  var wrap = document.getElementById('pay-methods');
  if (!wrap) return;
  wrap.innerHTML = PAYMENT_METHODS.map(function (m) {
    return '<button type="button" class="pay-method' + (m.id === selectedPay ? ' selected' : '') + '" data-pay="' + m.id + '" aria-pressed="' + (m.id === selectedPay) + '">'
      + '<span class="pay-logo" style="color:' + m.color + '">' + m.logo + '</span>'
      + '<span>' + m.name + '</span>'
      + '<span class="pay-dot" aria-hidden="true"></span>'
      + '</button>';
  }).join('');
  wrap.querySelectorAll('.pay-method').forEach(function (btn) {
    btn.addEventListener('click', function () {
      selectPay(btn.getAttribute('data-pay'));
    });
  });
  var cardFields = document.getElementById('card-fields');
  if (cardFields) {
    var method = getPayMethod(selectedPay);
    cardFields.hidden = !(method && method.requiresCard);
  }
}
function getPayMethod(id) {
  for (var i = 0; i < PAYMENT_METHODS.length; i++) {
    if (PAYMENT_METHODS[i].id === id) return PAYMENT_METHODS[i];
  }
  return null;
}
function selectPay(id) {
  selectedPay = id;
  renderPayMethods();
  updatePayBtn();
}
function renderOrderSummary() {
  var totals = cartTotals();
  var subEl = document.getElementById('co-subtotal');
  var gstEl = document.getElementById('co-gst');
  var totalEl = document.getElementById('co-total');
  if (subEl) subEl.textContent = fmtMoney(totals.subtotal);
  if (gstEl) gstEl.textContent = fmtMoney(totals.gst);
  if (totalEl) totalEl.textContent = fmtMoney(totals.total);
  updatePayBtn();
}
function updatePayBtn() {
  var btn = document.getElementById('pay-btn');
  if (!btn) return;
  var totals = cartTotals();
  btn.textContent = t('checkout.pay') + ' ' + fmtMoney(totals.total);
}
function openCheckout() {
  if (cart.length === 0) return;
  closeCart();
  var overlay = document.getElementById('checkout-overlay');
  if (!overlay) return;
  document.getElementById('checkout-form').hidden = false;
  document.getElementById('checkout-success').hidden = true;
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  renderOrderSummary();
  renderPayMethods();
}
function closeCheckout() {
  var overlay = document.getElementById('checkout-overlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}
function saveOrder(orderData) {
  try {
    var orders = JSON.parse(localStorage.getItem('smt-orders') || '[]');
    orders.push(orderData);
    localStorage.setItem('smt-orders', JSON.stringify(orders));
  } catch (e) {}
}
function showPaymentSuccess(orderData) {
  document.getElementById('checkout-form').hidden = true;
  document.getElementById('checkout-success').hidden = false;
  document.getElementById('success-order-id').textContent = orderData.orderId;
  var viewBtn = document.getElementById('success-view');
  if (viewBtn) viewBtn.setAttribute('href', 'order.html?order=' + encodeURIComponent(orderData.orderId));
}
function readCheckoutForm(form) {
  function get(n) {
    var el = form.querySelector('[name="' + n + '"]');
    return el ? el.value.trim() : '';
  }
  var d = {
    name: get('name'), email: get('email'), phone: get('phone'),
    address: get('address'), city: get('city'), postal: get('postal'),
    country: get('country') || 'OTHER'
  };
  d.cardNumber = get('cardNumber');
  d.cardExpiry = get('cardExpiry');
  d.cardCvc = get('cardCvc');
  return d;
}

function hasRequiredFields(d) {
  return !!(d.name && d.email && d.phone && d.address && d.city);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hasCardDetails(d) {
  var method = getPayMethod(selectedPay);
  if (!method || !method.requiresCard) return true;
  return !!(d.cardNumber && d.cardExpiry && d.cardCvc);
}

function validateCheckout(d) {
  if (!hasRequiredFields(d)) return 'checkout.required';
  if (!isValidEmail(d.email)) return 'checkout.invalidEmail';
  if (!hasCardDetails(d)) return 'checkout.required';
  return null;
}
function buildOrderPayload(d) {
  var totals = cartTotals();
  return {
    items: cart.map(function (item) {
      var tier = getTier(item.tierId);
      return { productId: item.productId, tierId: item.tierId, quantity: item.quantity, price: tier ? tier.price : 0 };
    }),
    amounts: { subtotal: totals.subtotal, tax: totals.gst, total: totals.total, currency: CURRENCY },
    paymentMethod: selectedPay,
    customer: {
      name: d.name, email: d.email, phone: d.phone,
      address: d.address, city: d.city, postal: d.postal, country: d.country
    },
    inviteCode: (typeof getInviteCode === 'function') ? getInviteCode() : '',
    createdAt: new Date().toISOString()
  };
}

function runPayment(orderData) {
  return PaymentService.createOrder(orderData.amounts)
    .then(function (created) {
      orderData.orderId = created.orderId;
      return PaymentService.initiatePayment(selectedPay, created.orderId);
    })
    .then(function () {
      return PaymentService.checkPaymentStatus(orderData.orderId);
    })
    .then(function (paid) {
      orderData.payment = {
        status: paid.status,
        transactionId: paid.transactionId,
        paidAt: new Date().toISOString()
      };
      saveOrder(orderData);
      cart = [];
      renderCart();
      updateCartCount();
      showPaymentSuccess(orderData);
      return orderData;
    });
}

function placeOrder(e) {
  if (e) e.preventDefault();
  var form = document.getElementById('checkout-form');
  var btn = document.getElementById('pay-btn');
  if (!form || !btn) return;

  var data = readCheckoutForm(form);
  var errKey = validateCheckout(data);
  if (errKey) {
    showToast(t(errKey));
    return;
  }

  var orderData = buildOrderPayload(data);
  var originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = t('checkout.processing');

  runPayment(orderData).catch(function (err) {
    btn.disabled = false;
    btn.textContent = originalText;
    showToast(t('checkout.failed'));
    if (window.console && console.warn) console.warn('[placeOrder] failed:', err);
  });
}
