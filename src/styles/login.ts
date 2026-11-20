export const COMMON_CSS = `
.error { color: #1f1f1f; font-weight: 700; }
button { font: inherit; }
`;

export const LOGIN_CSS = `
.login {
  align-items: center;
  background: #cccccc;
  display: flex;
  justify-content: center;
  min-height: 100vh;
  padding: 24px;
}

.login-card {
  background: #d8d8d8;
  border: 2px solid #1f1f1f;
  border-radius: 8px;
  display: grid;
  gap: 16px;
  max-width: 360px;
  padding: 24px;
  width: 100%;
}

.login-card label {
  display: grid;
  font-size: 14px;
  font-weight: 600;
  gap: 6px;
}

.login-card input {
  background: #e4e4e4;
  border: 2px solid #1f1f1f;
  border-radius: 6px;
  color: #303030;
  font: inherit;
  min-height: 34px;
  padding: 6px 10px;
}
`;

export const LOGIN_EXTRA_CSS = `
.login-actions {
  display: grid;
  gap: 10px;
}

/* スマホで押しやすいよう、ログイン導線は全幅・高さ48px以上にする */
.login-actions .button,
.login-reset .button {
  align-items: center;
  display: flex;
  justify-content: center;
  min-height: 48px;
  padding: 12px 16px;
  width: 100%;
}

.login-reset {
  margin: 0;
}

.login-error {
  background: #ffffff;
  border: 2px solid #1f1f1f;
  border-radius: 8px;
  display: grid;
  gap: 4px;
  padding: 12px 14px;
}

.login-error__message {
  color: #8a2b2b;
  font-size: 13px;
  font-weight: 700;
  margin: 0;
}

.login-hint {
  color: #39424d;
  font-size: 11.5px;
  margin: 0;
}
`;
