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
        const error = new Error(data.error || 'İşlem başarısız.');
        error.code = data.code;
        throw error;
      }
      return data;
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err.message);
      throw err;
    }
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
  claimReferralBalance: () => API.request('/account/referrals/claim', { method: 'POST' }),
  getNotifications: () => API.request('/account/notifications'),
  markNotificationsRead: () => API.request('/account/notifications/read', { method: 'POST' }),

  // Services
  getServices: (lang = 'tr') => API.request(`/services?lang=${encodeURIComponent(lang)}`),

  // Orders
  createOrder: (service_id, link, quantity, drip_runs = 1, drip_interval_minutes = null) => API.request('/orders', { method: 'POST', body: JSON.stringify({ service_id, link, quantity, drip_runs, drip_interval_minutes }) }),
  getOrders: (lang = 'tr') => API.request(`/orders?lang=${encodeURIComponent(lang)}`),
  requestRefill: (orderId) => API.request(`/orders/${orderId}/refill`, { method: 'POST' }),

  // Payments & Coupons
  addFunds: (amount, method) => API.request('/payments/add-funds', { method: 'POST', body: JSON.stringify({ amount, method }) }),
  createPaytrPayment: (amount) => API.request('/payments/paytr/token', { method: 'POST', body: JSON.stringify({ amount }) }),
  redeemCoupon: (code) => API.request('/payments/coupon/redeem', { method: 'POST', body: JSON.stringify({ code }) }),
  sendPaymentNotification: (data) => API.request('/payments/notification', { method: 'POST', body: JSON.stringify(data) }),

  // Tickets
  getTickets: () => API.request('/tickets'),
  createTicket: (subject, message) => API.request('/tickets', { method: 'POST', body: JSON.stringify({ subject, message }) }),
  getTicketDetails: (id) => API.request(`/tickets/${id}`),
  replyTicket: (id, message) => API.request(`/tickets/${id}/reply`, { method: 'POST', body: JSON.stringify({ message }) }),

  // Admin
  getAdminStats: () => API.request('/admin/stats'),
  getAdminProviders: () => API.request('/admin/providers'),
  addAdminProvider: (name, api_url, api_key) => API.request('/admin/providers', { method: 'POST', body: JSON.stringify({ name, api_url, api_key }) }),
  importProviderServices: (providerId, profit_percentage) => API.request(`/admin/providers/${providerId}/import-services`, { method: 'POST', body: JSON.stringify({ profit_percentage }) }),
  getRawProviderServices: (providerId) => API.request(`/admin/providers/${providerId}/raw-services`),
  getAdminServices: () => API.request('/admin/services'),
  refreshAdminProviderPrices: () => API.request('/admin/services/refresh-provider-prices', { method: 'POST' }),
  auditAdminProviderPrices: () => API.request('/admin/services/provider-price-audit', { method: 'POST' }),
  applyAdminProviderPrice: (id, profit_percentage) => API.request(`/admin/services/${id}/apply-provider-price`, { method: 'POST', body: JSON.stringify({ profit_percentage }) }),
  addAdminService: (data) => API.request('/admin/services', { method: 'POST', body: JSON.stringify(data) }),
  updateAdminService: (id, data) => API.request(`/admin/services/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAdminService: (id) => API.request(`/admin/services/${id}`, { method: 'DELETE' }),
  bulkDeleteAdminServices: (data) => API.request('/admin/services/bulk-delete', { method: 'POST', body: JSON.stringify(data) }),
  bulkStatusAdminServices: (data) => API.request('/admin/services/bulk-status', { method: 'POST', body: JSON.stringify(data) }),
  getAdminUsers: () => API.request('/admin/users'),
  updateUserBalance: (userId, amount, action) => API.request(`/admin/users/${userId}/balance`, { method: 'POST', body: JSON.stringify({ amount, action }) }),
  getAdminOrders: () => API.request('/admin/orders'),
  updateOrderStatus: (orderId, status) => API.request(`/admin/orders/${orderId}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  getAdminPaymentNotifications: () => API.request('/admin/payment-notifications'),
  approveAdminPaymentNotification: (id) => API.request(`/admin/payment-notifications/${id}/approve`, { method: 'POST' }),
  rejectAdminPaymentNotification: (id) => API.request(`/admin/payment-notifications/${id}/reject`, { method: 'POST' }),
  getAdminCoupons: () => API.request('/admin/coupons'),
  addAdminCoupon: (code, amount, max_uses) => API.request('/admin/coupons', { method: 'POST', body: JSON.stringify({ code, amount, max_uses }) }),
  deleteAdminCoupon: (id) => API.request(`/admin/coupons/${id}`, { method: 'DELETE' }),
  resetDemoData: () => API.request('/admin/reset-demo-data', { method: 'POST' }),
  changeAdminPassword: (current_password, new_password) => API.request('/admin/change-password', { method: 'POST', body: JSON.stringify({ current_password, new_password }) }),
  getSettings: () => API.request('/admin/settings'),
  saveSettings: (settingsObj) => API.request('/admin/settings', { method: 'POST', body: JSON.stringify(settingsObj) }),

  // Public Blog
  getBlogPosts: (lang = 'tr') => API.request(`/blog?lang=${encodeURIComponent(lang)}`),
  getBlogPostDetail: (slug, lang = 'tr') => API.request(`/blog/${slug}?lang=${encodeURIComponent(lang)}`),

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
