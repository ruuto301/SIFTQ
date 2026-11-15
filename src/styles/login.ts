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
