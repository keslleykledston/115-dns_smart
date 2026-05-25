/**
 * DNS Smart GUI — Login Screen View
 */
import { $ } from '../utils/dom.js';
import ApiClient from '../api.js';
import { Toast } from '../components/toast.js';
export class LoginView {
    static render(container, onLoginSuccess) {
        container.innerHTML = `
      <div class="glass-card" style="width: 100%; max-width: 420px; padding: 40px; border-radius: var(--radius-lg); position: relative; overflow: hidden; box-shadow: var(--shadow-card), var(--shadow-glow);">
        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 4px; background: var(--gradient-premium);"></div>
        
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="width: 50px; height: 50px; background: var(--gradient-cyber); border-radius: var(--radius-sm); display: inline-flex; align-items: center; justify-content: center; font-size: 1.4rem; font-weight: 800; color: white; box-shadow: 0 0 15px rgba(236, 72, 153, 0.4); margin-bottom: 16px;">DS</div>
          <h2 style="font-size: 1.6rem; font-weight: 700; margin-bottom: 4px; background: var(--gradient-premium); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">DNS SMART</h2>
          <p style="color: var(--text-secondary); font-size: 0.9rem;">Advanced Management Control Panel</p>
        </div>

        <form id="login-form">
          <div class="form-group">
            <label for="username">Username</label>
            <input type="text" id="username" class="input-field" placeholder="admin" required autocomplete="username">
          </div>
          <div class="form-group" style="margin-bottom: 30px;">
            <label for="password">Password</label>
            <input type="password" id="password" class="input-field" placeholder="••••••••" required autocomplete="current-password">
          </div>

          <button type="submit" id="btn-login-submit" class="btn btn-primary" style="width: 100%; justify-content: center; padding: 14px;">
            Access System
          </button>
        </form>
      </div>
    `;
        const form = $('#login-form', container);
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = $('#username', container).value;
            const password = $('#password', container).value;
            const submitBtn = $('#btn-login-submit', container);
            submitBtn.disabled = true;
            submitBtn.innerText = 'Verifying security...';
            try {
                const response = await ApiClient.post('/api/auth/login', { username, password });
                if (response && response.token) {
                    localStorage.setItem('token', response.token);
                    localStorage.setItem('user', JSON.stringify(response.user));
                    Toast.success(`Welcome back, ${response.user.username}!`);
                    onLoginSuccess();
                }
                else {
                    submitBtn.disabled = false;
                    submitBtn.innerText = 'Access System';
                }
            }
            catch (err) {
                submitBtn.disabled = false;
                submitBtn.innerText = 'Access System';
                Toast.error('An error occurred during verification.');
            }
        });
    }
}
