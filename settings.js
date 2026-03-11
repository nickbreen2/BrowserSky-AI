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
  const { clerkUser, userFullName } = await chrome.storage.local.get(['clerkUser', 'userFullName']);

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

  // Connected accounts
  const connectedList = document.getElementById('connectedAccountsList');
  const externalAccounts = clerkUser?.externalAccounts || [];
  const PROVIDER_META = {
    google: {
      label: 'Google',
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>`,
    },
    apple: {
      label: 'Apple',
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.42c1.27.06 2.15.66 2.88.68.95-.19 1.86-.8 2.88-.76 1.22.06 2.14.52 2.74 1.37-2.52 1.5-1.9 4.84.46 5.77-.55 1.56-1.28 3.08-2.96 3.8zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>`,
    },
  };

  if (externalAccounts.length === 0) {
    connectedList.innerHTML = `<div class="connected-empty">No connected accounts</div>`;
  } else {
    connectedList.innerHTML = externalAccounts.map(account => {
      const provider = (account.provider || account.verification?.strategy || '').toLowerCase().replace('oauth_', '');
      const meta = PROVIDER_META[provider] || { label: provider, icon: '' };
      const accountEmail = account.emailAddress || account.email_address || '';
      return `
        <div class="connected-account-row">
          <div class="connected-account-icon">${meta.icon}</div>
          <div class="connected-account-info">
            <div class="connected-account-label">${meta.label}</div>
            ${accountEmail ? `<div class="connected-account-email">${accountEmail}</div>` : ''}
          </div>
          <div class="connected-account-badge">Connected</div>
        </div>`;
    }).join('');
  }

  // Full name field
  const nameInput = document.getElementById('fullNameInput');
  if (userFullName) nameInput.value = userFullName;
  document.getElementById('saveNameBtn').addEventListener('click', async () => {
    await chrome.storage.local.set({ userFullName: nameInput.value.trim() });
    const btn = document.getElementById('saveNameBtn');
    btn.textContent = 'Saved!';
    setTimeout(() => { btn.textContent = 'Save'; }, 1500);
  });

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
