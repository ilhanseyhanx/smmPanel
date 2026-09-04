const API_BASE = '/api';

const API = {
  // Oturum HttpOnly cookie'de tutulur; JavaScript token'a erişemez.
  getToken: () => true,
  setToken: () => {},
  clearToken: () => {},

  headers: () => {
    const headers = { 'Content-Type': 'application/json' };
    return headers;
  },

  async request(endpoint, options = {}) {
    const config = {
      headers: API.headers(),
      credentials: 'same-origin',
      ...options
    };

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, config);
      const contentType = res.headers.get('content-type') || '';
      const data = contentType.includes('application/json') ? await res.json() : {};
      if (!res.ok) {
        // JSON olmayan yanit (ör. nginx 502/504 HTML sayfasi) icin anlamli mesaj.
        const fallback = res.status === 504 || res.status === 524
          ? 'İşlem uzun sürdüğü için zaman aşımına uğradı. Lütfen tekrar deneyin.'
          : `Sunucu yanıt veremedi (${res.status}). Lütfen tekrar deneyin.`;
        // Sunucu mesaji iki dilli gelir; kullanicinin sectigi dile gore secilir.
        // Not: app global'i "const" ile tanimli, window uzerinden gorunmez.
        const locale = (typeof app !== 'undefined' && app?.locale === 'en') ? 'en' : 'tr';
        const message = (locale === 'en' && data.error_en) ? data.error_en : (data.error || fallback);
        const error = new Error(message);
        error.code = data.code;
        error.status = res.status;
        // Hangi alanda ne sorun oldugu: form alanlarinin altina yazilir.
        error.field = data.field || null;
        error.details = Array.isArray(data.details)
          ? data.details.map(item => ({
            field: item.field,
            message: (locale === 'en' && item.message_en) ? item.message_en : item.message
          }))
          : null;
        throw error;
      }
      return data;
    } catch (err) {
      // Oturum yokken /auth/me'nin 401 dönmesi normaldir; konsolu kirletmesin.
      if (!(endpoint === '/auth/me' && err.status === 401)) {
        console.error(`API Error [${endpoint}]:`, err.message);
      }
      throw err;
    }
  },

  // Dosya indirme: yanit JSON degil ikili veri oldugu icin request() kullanilamaz.
  // Sunucudan gelen dosya adi Content-Disposition basligindan okunur.
  async download(endpoint) {
    const res = await fetch(`${API_BASE}${endpoint}`, { credentials: 'same-origin' });
    if (!res.ok) {
      let message = `Dosya indirilemedi (${res.status}).`;
      try {
        const data = await res.json();
        if (data.error) message = data.error;
      } catch { /* JSON degilse varsayilan mesaj kalir */ }
      throw new Error(message);
    }

    const disposition = res.headers.get('content-disposition') || '';
    let fileName = 'liste.xlsx';
    const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    const plainMatch = disposition.match(/filename="([^"]+)"/i);
    if (utf8Match) fileName = decodeURIComponent(utf8Match[1]);
    else if (plainMatch) fileName = plainMatch[1];

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Bellegi hemen birakmak bazi tarayicilarda indirmeyi keser; kisa gecikme guvenli.
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return fileName;
  },

  // Auth
  login: (username, password, totp) => API.request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password, totp: totp || undefined }) }),
  register: (username, email, password, referral) => API.request('/auth/register', { method: 'POST', body: JSON.stringify({ username, email, password, referral: referral || undefined }) }),
  logout: () => API.request('/auth/logout', { method: 'POST' }),
  getMe: () => API.request('/auth/me'),
  changePassword: (current_password, new_password) => API.request('/auth/change-password', { method: 'POST', body: JSON.stringify({ current_password, new_password }) }),
  forgotPassword: (email) => API.request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token, new_password) => API.request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, new_password }) }),
  requestEmailVerification: () => API.request('/auth/verify-email/request', { method: 'POST' }),
  confirmEmailVerification: (token) => API.request('/auth/verify-email/confirm', { method: 'POST', body: JSON.stringify({ token }) }),
  setupTwoFactor: () => API.request('/auth/2fa/setup', { method: 'POST' }),
  confirmTwoFactor: (token) => API.request('/auth/2fa/confirm', { method: 'POST', body: JSON.stringify({ token }) }),
  getAccountSummary: () => API.request('/account/summary'),
  getPaymentHistory: () => API.request('/account/payments'),
  getApiKey: () => API.request('/account/api-key'),
  createApiKey: (regenerate = false) => API.request('/account/api-key', { method: 'POST', body: JSON.stringify({ regenerate }) }),
  getReferralOverview: () => API.request('/account/referrals'),
  claimReferralBalance: () => API.request('/account/referrals/claim', { method: 'POST' }),
  getNotifications: () => API.request('/account/notifications'),
  markNotificationsRead: () => API.request('/account/notifications/read', { method: 'POST' }),

  // Services
  getServices: (lang = 'tr') => API.request(`/services?lang=${encodeURIComponent(lang)}`),

  // Orders
  createOrder: (service_id, link, quantity, drip_runs = 1, drip_interval_minutes = null, lang = 'tr') => API.request('/orders', { method: 'POST', body: JSON.stringify({ service_id, link, quantity, drip_runs, drip_interval_minutes, lang }) }),
  getOrders: (lang = 'tr') => API.request(`/orders?lang=${encodeURIComponent(lang)}`),
  requestRefill: (orderId) => API.request(`/orders/${orderId}/refill`, { method: 'POST' }),

  // Payments & Coupons
  addFunds: (amount, method) => API.request('/payments/add-funds', { method: 'POST', body: JSON.stringify({ amount, method }) }),
  createPaytrPayment: (amount) => API.request('/payments/paytr/token', { method: 'POST', body: JSON.stringify({ amount }) }),
  createShopierPayment: (amount) => API.request('/payments/shopier/create', { method: 'POST', body: JSON.stringify({ amount }) }),
  getShopierStatus: () => API.request('/admin/shopier/status'),
  saveShopierPat: (pat) => API.request('/admin/shopier/pat', { method: 'POST', body: JSON.stringify({ pat }) }),
  registerShopierWebhook: () => API.request('/admin/shopier/register-webhook', { method: 'POST' }),
  removeShopierConfig: () => API.request('/admin/shopier/config', { method: 'DELETE' }),
  saveShopierImage: (image_url) => API.request('/admin/shopier/image', { method: 'POST', body: JSON.stringify({ image_url }) }),
  getShopierPaymentStatus: (oid) => API.request(`/payments/shopier/status/${encodeURIComponent(oid)}`),
  getCryptoCurrencies: () => API.request('/payments/nowpayments/currencies'),
  getCryptoMin: (coin) => API.request(`/payments/nowpayments/min/${encodeURIComponent(coin)}`),
  createCryptoPayment: (amount, pay_currency) => API.request('/payments/nowpayments/create', { method: 'POST', body: JSON.stringify({ amount, pay_currency }) }),
  getCryptoPaymentStatus: (oid) => API.request(`/payments/nowpayments/status/${encodeURIComponent(oid)}`),
  redeemCoupon: (code) => API.request('/payments/coupon/redeem', { method: 'POST', body: JSON.stringify({ code }) }),
  sendPaymentNotification: (data) => API.request('/payments/notification', { method: 'POST', body: JSON.stringify(data) }),

  // Tickets
  getTickets: () => API.request('/tickets'),
  createTicket: (subject, message) => API.request('/tickets', { method: 'POST', body: JSON.stringify({ subject, message }) }),
  getTicketDetails: (id) => API.request(`/tickets/${id}`),
  replyTicket: (id, message) => API.request(`/tickets/${id}/reply`, { method: 'POST', body: JSON.stringify({ message }) }),

  // Admin
  getAdminStats: () => API.request('/admin/stats'),
  getAdminStatistics: () => API.request('/admin/statistics'),
  getAdminProviders: () => API.request('/admin/providers'),
  addAdminProvider: (name, api_url, api_key) => API.request('/admin/providers', { method: 'POST', body: JSON.stringify({ name, api_url, api_key }) }),
  deleteAdminProvider: (id) => API.request(`/admin/providers/${id}`, { method: 'DELETE' }),
  importProviderServices: (providerId, profit_percentage) => API.request(`/admin/providers/${providerId}/import-services`, { method: 'POST', body: JSON.stringify({ profit_percentage }) }),
  getRawProviderServices: (providerId) => API.request(`/admin/providers/${providerId}/raw-services`),
  exportProviderServices: (providerId) => API.download(`/admin/providers/${providerId}/services/export`),
  exportAdminServices: (status = 'all') => API.download(`/admin/services/export?status=${encodeURIComponent(status)}`),
  getAdminServices: () => API.request('/admin/services'),
  refreshAdminProviderPrices: () => API.request('/admin/services/refresh-provider-prices', { method: 'POST' }),
  auditAdminProviderPrices: () => API.request('/admin/services/provider-price-audit', { method: 'POST' }),
  applyAdminProviderPrice: (id, profit_percentage) => API.request(`/admin/services/${id}/apply-provider-price`, { method: 'POST', body: JSON.stringify({ profit_percentage }) }),
  addAdminService: (data) => API.request('/admin/services', { method: 'POST', body: JSON.stringify(data) }),
  updateAdminService: (id, data) => API.request(`/admin/services/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAdminService: (id) => API.request(`/admin/services/${id}`, { method: 'DELETE' }),
  setAdminServiceFavorite: (id, favorite) => API.request(`/admin/services/${id}/favorite`, { method: 'POST', body: JSON.stringify({ favorite }) }),
  bulkDeleteAdminServices: (data) => API.request('/admin/services/bulk-delete', { method: 'POST', body: JSON.stringify(data) }),
  bulkStatusAdminServices: (data) => API.request('/admin/services/bulk-status', { method: 'POST', body: JSON.stringify(data) }),
  getAdminUsers: (q = '') => API.request(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  updateUserBalance: (userId, amount, action) => API.request(`/admin/users/${userId}/balance`, { method: 'POST', body: JSON.stringify({ amount, action }) }),
  setUserBan: (userId, banned) => API.request(`/admin/users/${userId}/ban`, { method: 'POST', body: JSON.stringify({ banned }) }),
  setUserPassword: (userId, new_password) => API.request(`/admin/users/${userId}/password`, { method: 'POST', body: JSON.stringify({ new_password }) }),
  deleteUser: (userId) => API.request(`/admin/users/${userId}`, { method: 'DELETE' }),
  assignUserOrder: (userId, data) => API.request(`/admin/users/${userId}/assign-order`, { method: 'POST', body: JSON.stringify(data) }),
  getAdminOrders: (q = '') => API.request(`/admin/orders${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  updateOrderStatus: (orderId, status) => API.request(`/admin/orders/${orderId}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  sendOrderReviewMail: (orderId) => API.request(`/admin/orders/${orderId}/review-mail`, { method: 'POST' }),
  requestVerifyCode: () => API.request('/auth/verify-email/request-code', { method: 'POST' }),
  confirmVerifyCode: (code) => API.request('/auth/verify-email/confirm-code', { method: 'POST', body: JSON.stringify({ code }) }),
  getAdminPayments: (q = '', method = '') => API.request(`/admin/payments?q=${encodeURIComponent(q)}&method=${encodeURIComponent(method)}`),
  getAdminPaymentNotifications: () => API.request('/admin/payment-notifications'),
  approveAdminPaymentNotification: (id) => API.request(`/admin/payment-notifications/${id}/approve`, { method: 'POST' }),
  rejectAdminPaymentNotification: (id) => API.request(`/admin/payment-notifications/${id}/reject`, { method: 'POST' }),
  getAdminCoupons: () => API.request('/admin/coupons'),
  addAdminCoupon: (code, amount, max_uses, code_en = null) => API.request('/admin/coupons', { method: 'POST', body: JSON.stringify({ code, code_en, amount, max_uses }) }),
  getCouponUsages: (id) => API.request(`/admin/coupons/${id}/usages`),
  deleteAdminCoupon: (id) => API.request(`/admin/coupons/${id}`, { method: 'DELETE' }),
  resetDemoData: () => API.request('/admin/reset-demo-data', { method: 'POST' }),
  getSecurityOverview: (type = '') => API.request(`/admin/security/overview${type ? `?type=${encodeURIComponent(type)}` : ''}`),
  blockSecurityIp: (ip, reason = '') => API.request('/admin/security/block-ip', { method: 'POST', body: JSON.stringify({ ip, reason }) }),
  unblockSecurityIp: (ip) => API.request('/admin/security/unblock-ip', { method: 'POST', body: JSON.stringify({ ip }) }),
  changeAdminPassword: (current_password, new_password) => API.request('/admin/change-password', { method: 'POST', body: JSON.stringify({ current_password, new_password }) }),
  getSettings: () => API.request('/admin/settings'),
  saveSettings: (settingsObj) => API.request('/admin/settings', { method: 'POST', body: JSON.stringify(settingsObj) }),
  sendTelegramTest: () => API.request('/admin/telegram/test', { method: 'POST' }),

  // Musteri yorumlari
  submitReview: (rating, comment) => API.request('/account/review', { method: 'POST', body: JSON.stringify({ rating, comment }) }),
  getAdminReviews: () => API.request('/admin/reviews'),
  addAdminReview: (display_name, rating, comment) => API.request('/admin/reviews', { method: 'POST', body: JSON.stringify({ display_name, rating, comment }) }),
  setAdminReviewStatus: (id, status) => API.request(`/admin/reviews/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  deleteAdminReview: (id) => API.request(`/admin/reviews/${id}`, { method: 'DELETE' }),
  sendEmailTest: (to = null) => API.request('/admin/email/test', { method: 'POST', body: JSON.stringify({ to }) }),

  // Email marketing (Admin)
  getEmailTemplates: () => API.request('/admin/email/templates'),
  createEmailTemplate: (payload) => API.request('/admin/email/templates', { method: 'POST', body: JSON.stringify(payload) }),
  updateEmailTemplate: (id, payload) => API.request(`/admin/email/templates/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteEmailTemplate: (id) => API.request(`/admin/email/templates/${id}`, { method: 'DELETE' }),
  testEmailTemplate: (id) => API.request(`/admin/email/templates/${id}/test`, { method: 'POST' }),
  sendEmailBlast: (payload) => API.request('/admin/email/send', { method: 'POST', body: JSON.stringify(payload) }),
  getEmailStats: () => API.request('/admin/email/stats'),
  getEmailFailures: (batchId) => API.request(`/admin/email/failures/${encodeURIComponent(batchId)}`),
  getTelegramChats: () => API.request('/admin/telegram/chats'),

  // Campaigns (Admin)
  getAdminCampaigns: () => API.request('/admin/campaigns'),
  createCampaign: (payload) => API.request('/admin/campaigns', { method: 'POST', body: JSON.stringify(payload) }),
  setCampaignStatus: (id, status) => API.request(`/admin/campaigns/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  deleteCampaign: (id) => API.request(`/admin/campaigns/${id}`, { method: 'DELETE' }),
  // Campaigns (Public popup istatistigi)
  campaignEvent: (id, type) => API.request(`/campaigns/${id}/event`, { method: 'POST', body: JSON.stringify({ type }) }),

  // Account Telegram linking
  getTelegramStatus: () => API.request('/account/telegram/status'),
  createTelegramLinkCode: () => API.request('/account/telegram/link-code', { method: 'POST' }),
  disconnectTelegram: () => API.request('/account/telegram/disconnect', { method: 'POST' }),

  // Public Blog
  getBlogPosts: (lang = 'tr') => API.request(`/blog?lang=${encodeURIComponent(lang)}`),
  getBlogPostDetail: (slug, lang = 'tr') => API.request(`/blog/${slug}?lang=${encodeURIComponent(lang)}`),

  // Satış sayfaları (platform bazlı landing page'ler)
  getLandingPages: (lang = 'tr') => API.request(`/landing-pages?lang=${encodeURIComponent(lang)}`),
  getLandingPage: (slug, lang = 'tr') => API.request(`/landing-pages/${encodeURIComponent(slug)}?lang=${encodeURIComponent(lang)}`),
  getAdminLandingPages: () => API.request('/admin/landing-pages'),
  previewAdminLandingPage: (id, lang = 'tr') => API.request(`/admin/landing-pages/${id}/preview?lang=${encodeURIComponent(lang)}`),
  addAdminLandingPage: (data) => API.request('/admin/landing-pages', { method: 'POST', body: JSON.stringify(data) }),
  updateAdminLandingPage: (id, data) => API.request(`/admin/landing-pages/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAdminLandingPage: (id) => API.request(`/admin/landing-pages/${id}`, { method: 'DELETE' }),

  // Admin Blog, Landing Platforms & Featured Cards
  getAdminBlogPosts: () => API.request('/admin/blog'),
  addAdminBlogPost: (data) => API.request('/admin/blog', { method: 'POST', body: JSON.stringify(data) }),
  updateAdminBlogPost: (id, data) => API.request(`/admin/blog/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAdminBlogPost: (id) => API.request(`/admin/blog/${id}`, { method: 'DELETE' }),

  // AI Studio
  getAiProviders: () => API.request('/ai/providers'),
  addAiProvider: (data) => API.request('/ai/providers', { method: 'POST', body: JSON.stringify(data) }),
  updateAiProvider: (id, data) => API.request(`/ai/providers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAiProvider: (id) => API.request(`/ai/providers/${id}`, { method: 'DELETE' }),
  testAiProvider: (id) => API.request(`/ai/providers/${id}/test`, { method: 'POST' }),
  getAiProviderModels: (id) => API.request(`/ai/providers/${id}/models`),
  activateAiProviderModel: (id, model) => API.request(`/ai/providers/${id}/activate-model`, { method: 'POST', body: JSON.stringify({ model }) }),
  getAiConversations: () => API.request('/ai/conversations'),
  getAiConversation: (id) => API.request(`/ai/conversations/${id}`),
  sendAiMessage: (data) => API.request('/ai/chat', { method: 'POST', body: JSON.stringify(data) }),
  executeAiAction: (id) => API.request(`/ai/actions/${id}/execute`, { method: 'POST' }),
  rejectAiAction: (id) => API.request(`/ai/actions/${id}/reject`, { method: 'POST' }),

  getAdminPlatforms: () => API.request('/admin/landing-platforms'),
  addAdminPlatform: (name, icon) => API.request('/admin/landing-platforms', { method: 'POST', body: JSON.stringify({ name, icon }) }),
  toggleAdminPlatformStatus: (id, status) => API.request(`/admin/landing-platforms/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  deleteAdminPlatform: (id) => API.request(`/admin/landing-platforms/${id}`, { method: 'DELETE' }),

  getAdminCards: () => API.request('/admin/featured-cards'),
  addAdminCard: (title, subtitle, highlight) => API.request('/admin/featured-cards', { method: 'POST', body: JSON.stringify({ title, subtitle, highlight }) }),
  toggleAdminCardStatus: (id, status) => API.request(`/admin/featured-cards/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  deleteAdminCard: (id) => API.request(`/admin/featured-cards/${id}`, { method: 'DELETE' })
};
