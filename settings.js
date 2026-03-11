// Browsersky Settings Page

const AVATAR_COLORS = [
  '#1a73e8', '#ea4335', '#34a853', '#fa7b17',
  '#9c27b0', '#00897b', '#e91e63', '#3949ab',
  '#039be5', '#f4511e', '#0b8043', '#8e24aa',
];

function getAvatarColor(str) {
  if (!str) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const MONTHLY_PRICE = 20;
const ANNUAL_PRICE  = Math.round(MONTHLY_PRICE * 12 * 0.65 / 12); // ~$13/mo
const ANNUAL_TOTAL  = ANNUAL_PRICE * 12;

let billingPeriod = 'monthly';

function updatePricing() {
  const isAnnual = billingPeriod === 'annual';
  document.getElementById('proPrice').textContent = isAnnual ? `$${ANNUAL_PRICE}` : `$${MONTHLY_PRICE}`;
  document.getElementById('proPeriod').textContent = '/ month';

  const originalEl = document.getElementById('proOriginalPrice');
  originalEl.style.display = isAnnual ? 'inline' : 'none';
  originalEl.textContent = `$${MONTHLY_PRICE}`;

  const billedNote = document.getElementById('proBilledNote');
  billedNote.style.display = isAnnual ? 'block' : 'none';
  document.getElementById('proAnnualTotal').textContent = ANNUAL_TOTAL;
}

const FREE_DAILY_CREDITS  = 50;
const PRO_MONTHLY_CREDITS = 2000;

async function getCreditState() {
  const { creditBalance, creditResetAt, userTier = 'free' } =
    await chrome.storage.local.get(['creditBalance', 'creditResetAt', 'userTier']);

  const now = Date.now();
  if (!creditResetAt || now >= creditResetAt) {
    const balance = userTier === 'pro' ? PRO_MONTHLY_CREDITS : FREE_DAILY_CREDITS;
    const resetIn = userTier === 'pro' ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const nextReset = now + resetIn;
    await chrome.storage.local.set({ creditBalance: balance, creditResetAt: nextReset });
    return { balance, resetAt: nextReset, userTier };
  }

  return { balance: creditBalance ?? FREE_DAILY_CREDITS, resetAt: creditResetAt, userTier };
}

async function init() {
  const { clerkUser } = await chrome.storage.local.get(['clerkUser']);

  // Credits
  const { balance, resetAt, userTier } = await getCreditState();
  document.getElementById('usageCredits').textContent = balance.toLocaleString();
  const descEl = document.getElementById('usageCreditsDesc');
  if (descEl) {
    const msLeft = resetAt - Date.now();
    const hLeft  = Math.ceil(msLeft / (1000 * 60 * 60));
    const label  = userTier === 'pro'
      ? `credits left · renews in ${Math.ceil(hLeft / 24)}d (Pro)`
      : `credits left · renews in ${hLeft}h (Free)`;
    descEl.textContent = label;
  }

  if (clerkUser) {
    const imageUrl = clerkUser.imageUrl || clerkUser.profileImageUrl;
    const firstName = clerkUser.firstName || '';
    const email = clerkUser.emailAddresses?.[0]?.emailAddress || clerkUser.email || '';
    const initial = (firstName[0] || email[0] || '?').toUpperCase();
    const color = getAvatarColor(firstName || email);

    const avatarEl = document.getElementById('settingsAvatar');
    avatarEl.style.background = color;
    if (imageUrl) {
      avatarEl.innerHTML = `<img src="${imageUrl}" alt="Profile" onerror="this.parentElement.innerHTML='<span>${initial}</span>';this.parentElement.style.background='${color}'">`;
    } else {
      avatarEl.innerHTML = `<span>${initial}</span>`;
    }
    document.getElementById('settingsEmail').textContent = email || '—';
    document.getElementById('headerEmail').textContent = email || '—';
  }

  // Tab switching
  document.querySelectorAll('.sidebar-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sidebar-item').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      const tabId = 'tab' + btn.dataset.tab.charAt(0).toUpperCase() + btn.dataset.tab.slice(1);
      document.getElementById(tabId).classList.add('active');
    });
  });

  // Billing toggle
  document.querySelectorAll('.billing-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.billing-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      billingPeriod = btn.dataset.period;
      updatePricing();
    });
  });
  updatePricing();

  // Sign out
  document.getElementById('signOutBtn').addEventListener('click', async () => {
    await chrome.storage.local.remove(['clerkToken', 'clerkUser']);
    window.close();
  });

  // Delete account — show modal
  document.getElementById('deleteAccountBtn').addEventListener('click', () => {
    document.getElementById('deleteModalBackdrop').style.display = 'flex';
  });
  document.getElementById('deleteModalCancel').addEventListener('click', () => {
    document.getElementById('deleteModalBackdrop').style.display = 'none';
  });
  document.getElementById('deleteModalBackdrop').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) document.getElementById('deleteModalBackdrop').style.display = 'none';
  });
  document.getElementById('deleteModalConfirm').addEventListener('click', () => {
    chrome.tabs.create({ url: `http://localhost:3000/settings/delete-account?extId=${chrome.runtime.id}` });
    document.getElementById('deleteModalBackdrop').style.display = 'none';
  });

  // Upgrade buttons
  const openUpgrade = () => chrome.tabs.create({ url: `http://localhost:3000/upgrade?extId=${chrome.runtime.id}` });
  document.getElementById('upgradeProBtn').addEventListener('click', openUpgrade);
  document.getElementById('usageUpgradeBtn').addEventListener('click', openUpgrade);
}

document.addEventListener('DOMContentLoaded', init);
