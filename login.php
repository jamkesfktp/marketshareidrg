<?php
session_start();

// Valid credentials (case-insensitive for username, flexible for password)
$valid_users = array(
    'jamkes2' => array('Kemenkes2026', 'kemenkes2026'),
    'admin' => array('Kemenkes2026', 'kemenkes2026'),
    'pusbikes' => array('Kemenkes2026', 'kemenkes2026'),
    'kemenkes' => array('Kemenkes2026', 'kemenkes2026')
);

// --- CAPTCHA GENERATION ---
if (!isset($_SESSION['captcha_result'])) {
    $num1 = rand(2, 9);
    $num2 = rand(1, 9);
    $_SESSION['captcha_result'] = $num1 + $num2;
    $_SESSION['captcha_text'] = "$num1 + $num2";
}

if (isset($_SESSION['user_logged_in']) && $_SESSION['user_logged_in'] === true) {
    header("Location: index.php");
    exit;
}

$error = '';
$success = '';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $username = isset($_POST['username']) ? trim($_POST['username']) : '';
    $password = isset($_POST['password']) ? $_POST['password'] : '';
    $captcha = isset($_POST['captcha']) ? trim($_POST['captcha']) : '';
    $session_captcha = isset($_SESSION['captcha_result']) ? $_SESSION['captcha_result'] : null;

    $username_key = strtolower($username);

    // 1. CAPTCHA Validation
    if ($session_captcha === null || $captcha != $session_captcha) {
        $error = "Hasil perhitungan CAPTCHA belum tepat. Silakan coba lagi.";
    } else {
        // 2. Credential Validation
        if (isset($valid_users[$username_key]) && in_array($password, $valid_users[$username_key])) {
            if (function_exists('session_regenerate_id')) {
                session_regenerate_id(true);
            }
            $_SESSION['user_logged_in'] = true;
            $_SESSION['username'] = !empty($username) ? $username : 'Jamkes2';
            header("Location: index.php");
            exit;
        } else {
            $error = "Username atau password salah. Silakan periksa kembali.";
        }
    }
    
    // Regenerate CAPTCHA after attempt
    $num1 = rand(2, 9);
    $num2 = rand(1, 9);
    $_SESSION['captcha_result'] = $num1 + $num2;
    $_SESSION['captcha_text'] = "$num1 + $num2";
}
?>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login · Portal Simulator Market Share Kemenkes RI</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        :root {
            --kemenkes-teal: #0d9488;
            --kemenkes-dark: #0f766e;
            --kemenkes-deep: #042f2e;
            --kemenkes-gold: #f59e0b;
            --text-main: #0f172a;
            --text-muted: #64748b;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        body {
            background: linear-gradient(135deg, #042f2e 0%, #0f766e 50%, #064e3b 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--text-main);
            padding: 1.25rem;
            position: relative;
            overflow-x: hidden;
        }

        body::before {
            content: '';
            position: absolute;
            width: 500px;
            height: 500px;
            background: radial-gradient(circle, rgba(20, 184, 166, 0.25) 0%, rgba(20, 184, 166, 0) 70%);
            top: -100px;
            right: -100px;
            border-radius: 50%;
            pointer-events: none;
        }

        body::after {
            content: '';
            position: absolute;
            width: 400px;
            height: 400px;
            background: radial-gradient(circle, rgba(245, 158, 11, 0.15) 0%, rgba(245, 158, 11, 0) 70%);
            bottom: -100px;
            left: -100px;
            border-radius: 50%;
            pointer-events: none;
        }

        .login-card {
            background: rgba(255, 255, 255, 0.96);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.8);
            border-radius: 1.5rem;
            padding: 2.5rem 2.25rem;
            width: 100%;
            max-width: 440px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(13, 148, 136, 0.1);
            position: relative;
            z-index: 10;
            animation: slideUp 0.5s ease-out forwards;
        }

        @keyframes slideUp {
            from { opacity: 0; transform: translateY(24px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .brand-header {
            text-align: center;
            margin-bottom: 1.75rem;
        }

        .brand-logo {
            height: 52px;
            margin-bottom: 12px;
            filter: drop-shadow(0 2px 6px rgba(13, 148, 136, 0.25));
        }

        .eyebrow {
            font-size: 0.72rem;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 1.2px;
            color: var(--kemenkes-teal);
            margin-bottom: 4px;
            display: block;
        }

        .brand-title {
            font-size: 1.4rem;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: -0.3px;
            line-height: 1.25;
            margin-bottom: 4px;
        }

        .brand-subtitle {
            color: var(--text-muted);
            font-size: 0.85rem;
            font-weight: 500;
        }

        .alert {
            padding: 0.8rem 1rem;
            border-radius: 0.75rem;
            margin-bottom: 1.25rem;
            font-size: 0.85rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
            line-height: 1.35;
        }

        .alert-error {
            background: #fef2f2;
            color: #b91c1c;
            border: 1px solid #fecaca;
        }

        .form-group {
            margin-bottom: 1.15rem;
        }

        .form-label {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.4rem;
            font-size: 0.85rem;
            font-weight: 700;
            color: #334155;
        }

        .input-wrapper {
            position: relative;
        }

        .form-control {
            width: 100%;
            padding: 0.8rem 1rem;
            background: #f8fafc;
            border: 1.5px solid #cbd5e1;
            border-radius: 0.75rem;
            color: #0f172a;
            font-size: 0.95rem;
            font-weight: 600;
            transition: all 0.2s ease;
            outline: none;
        }

        .form-control:focus {
            background: #ffffff;
            border-color: var(--kemenkes-teal);
            box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.15);
        }

        .toggle-password {
            position: absolute;
            right: 12px;
            top: 50%;
            transform: translateY(-50%);
            background: none;
            border: none;
            color: #64748b;
            cursor: pointer;
            font-size: 1rem;
            padding: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .captcha-box {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            background: #f0fdf4;
            border: 1.5px dashed #86efac;
            border-radius: 0.75rem;
            padding: 0.65rem 0.85rem;
        }

        .captcha-display {
            font-weight: 800;
            font-size: 1.2rem;
            letter-spacing: 2px;
            color: #15803d;
            background: #dcfce7;
            padding: 4px 10px;
            border-radius: 6px;
            user-select: none;
        }

        .btn-submit {
            width: 100%;
            padding: 0.85rem;
            background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%);
            color: white;
            border: none;
            border-radius: 0.75rem;
            font-size: 1rem;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(13, 148, 136, 0.3);
            transition: all 0.2s ease;
            margin-top: 0.5rem;
        }

        .btn-submit:hover {
            background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%);
            transform: translateY(-1px);
            box-shadow: 0 6px 16px rgba(13, 148, 136, 0.4);
        }

        .btn-submit:active {
            transform: translateY(1px);
        }

        .footer-note {
            text-align: center;
            font-size: 0.75rem;
            color: rgba(255, 255, 255, 0.75);
            margin-top: 1.5rem;
            font-weight: 500;
        }
    </style>
</head>
<body>

    <div style="display: flex; flex-direction: column; align-items: center; width: 100%; max-width: 440px;">
        <div class="login-card">
            <div class="brand-header">
                <img src="img/logo-kemenkes.png" alt="Logo Kemenkes" class="brand-logo">
                <span class="eyebrow">Kementerian Kesehatan Republik Indonesia</span>
                <h1 class="brand-title">Simulator Market Share</h1>
                <p class="brand-subtitle">Portal Analisis Uji Coba iDRG &amp; INA-CBG</p>
            </div>

            <?php if ($error): ?>
                <div class="alert alert-error">
                    <span>⚠️</span> <?php echo htmlspecialchars($error); ?>
                </div>
            <?php endif; ?>

            <form method="POST" action="" autocomplete="off">
                <div class="form-group">
                    <label class="form-label" for="username">Username</label>
                    <div class="input-wrapper">
                        <input type="text" id="username" name="username" class="form-control" value="<?php echo htmlspecialchars(isset($_POST['username']) ? $_POST['username'] : ''); ?>" placeholder="Masukkan username" required autofocus>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label" for="password">Password</label>
                    <div class="input-wrapper">
                        <input type="password" id="password" name="password" class="form-control" value="" placeholder="Masukkan password" required style="padding-right: 2.75rem;">
                        <button type="button" class="toggle-password" id="togglePassBtn" title="Tampilkan/Sembunyikan Password">👁️</button>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Verifikasi Keamanan (CAPTCHA)</label>
                    <div class="captcha-box">
                        <span class="captcha-display"><?php echo $_SESSION['captcha_text']; ?> = ?</span>
                        <input type="number" name="captcha" class="form-control" placeholder="Hasil" required style="flex: 1; padding: 0.6rem 0.75rem; background: #ffffff;">
                    </div>
                </div>

                <button type="submit" class="btn-submit">Masuk ke Portal &rarr;</button>
            </form>
        </div>

        <div class="footer-note">
            &copy; 2026 Pusat Kebijakan Pembiayaan dan Desentralisasi Kesehatan (PUSBIKES)<br>Kementerian Kesehatan Republik Indonesia
        </div>
    </div>

    <script>
        var passInput = document.getElementById('password');
        var toggleBtn = document.getElementById('togglePassBtn');

        if (toggleBtn) {
            toggleBtn.addEventListener('click', function() {
                if (passInput.type === 'password') {
                    passInput.type = 'text';
                    toggleBtn.textContent = '🙈';
                } else {
                    passInput.type = 'password';
                    toggleBtn.textContent = '👁️';
                }
            });
        }
    </script>
</body>
</html>
