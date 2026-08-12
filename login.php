<?php
session_start();

// --- SECURE BACKEND SIMULATION ---
// To prevent SQL Injection, ALWAYS use Prepared Statements (PDO or MySQLi).
// Example of a secure database connection and query using PDO:
/*
$host = '127.0.0.1';
$db   = 'my_database';
$user = 'db_user';
$pass = 'db_pass';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
     $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
     throw new \PDOException($e->getMessage(), (int)$e->getCode());
}

// Secure Login Query Example:
// $stmt = $pdo->prepare('SELECT id, password_hash FROM users WHERE username = ?');
// $stmt->execute([$_POST['username']]);
// $user = $stmt->fetch();
// if ($user && password_verify($_POST['password'], $user['password_hash'])) {
//     // Login successful
// }
*/

// --- CAPTCHA GENERATION ---
if (!isset($_SESSION['captcha_result'])) {
    $num1 = rand(1, 10);
    $num2 = rand(1, 10);
    $_SESSION['captcha_result'] = $num1 + $num2;
    $_SESSION['captcha_text'] = "$num1 + $num2";
}

$error = '';
$success = '';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';
    $captcha = trim($_POST['captcha'] ?? '');

    // 1. CAPTCHA Validation
    if ($captcha != $_SESSION['captcha_result']) {
        $error = "CAPTCHA salah. Silakan coba lagi.";
    } else {
        // 2. Mock Validation (Replace with DB check above)
        if ($username === 'Jamkes2' && $password === 'Kemenkes2026') {
            $success = "Login berhasil! Selamat datang, " . htmlspecialchars($username) . ".";
            // Regenerate session ID for security (prevent session fixation)
            session_regenerate_id(true);
        } else {
            $error = "Username atau password salah.";
        }
    }
    
    // Regenerate CAPTCHA after attempt
    $num1 = rand(1, 10);
    $num2 = rand(1, 10);
    $_SESSION['captcha_result'] = $num1 + $num2;
    $_SESSION['captcha_text'] = "$num1 + $num2";
}
?>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Secure Login Portal</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #2563eb;
            --primary-hover: #1d4ed8;
            --bg-gradient-start: #0f172a;
            --bg-gradient-end: #1e1b4b;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --card-bg: rgba(30, 41, 59, 0.7);
            --card-border: rgba(255, 255, 255, 0.1);
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: 'Inter', sans-serif;
        }

        body {
            background: linear-gradient(135deg, var(--bg-gradient-start), var(--bg-gradient-end));
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--text-main);
            padding: 1rem;
        }

        .login-container {
            background: var(--card-bg);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid var(--card-border);
            border-radius: 1.5rem;
            padding: 2.5rem;
            width: 100%;
            max-width: 420px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            animation: fadeIn 0.6s ease-out forwards;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .header {
            text-align: center;
            margin-bottom: 2rem;
        }

        .header h1 {
            font-size: 1.75rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
            background: linear-gradient(to right, #60a5fa, #a78bfa);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .header p {
            color: var(--text-muted);
            font-size: 0.95rem;
        }

        .form-group {
            margin-bottom: 1.25rem;
        }

        .form-group label {
            display: block;
            margin-bottom: 0.5rem;
            font-size: 0.9rem;
            font-weight: 500;
            color: #cbd5e1;
        }

        .form-control {
            width: 100%;
            padding: 0.875rem 1rem;
            background: rgba(15, 23, 42, 0.6);
            border: 1px solid var(--card-border);
            border-radius: 0.75rem;
            color: var(--text-main);
            font-size: 1rem;
            transition: all 0.3s ease;
        }

        .form-control:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.2);
            background: rgba(15, 23, 42, 0.8);
        }

        .captcha-container {
            display: flex;
            align-items: center;
            gap: 1rem;
            margin-bottom: 1.5rem;
            background: rgba(255,255,255,0.05);
            padding: 0.75rem;
            border-radius: 0.75rem;
            border: 1px dashed var(--card-border);
        }

        .captcha-text {
            font-weight: 700;
            font-size: 1.25rem;
            letter-spacing: 2px;
            color: #fbbf24;
            user-select: none;
        }

        .captcha-input {
            flex: 1;
        }

        .btn-submit {
            width: 100%;
            padding: 0.875rem;
            background: var(--primary);
            color: white;
            border: none;
            border-radius: 0.75rem;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }

        .btn-submit:hover {
            background: var(--primary-hover);
            transform: translateY(-1px);
        }

        .btn-submit:active {
            transform: translateY(1px);
        }

        .alert {
            padding: 1rem;
            border-radius: 0.75rem;
            margin-bottom: 1.5rem;
            font-size: 0.9rem;
            display: flex;
            align-items: center;
        }

        .alert-error {
            background: rgba(239, 68, 68, 0.1);
            color: #fca5a5;
            border: 1px solid rgba(239, 68, 68, 0.2);
        }

        .alert-success {
            background: rgba(34, 197, 94, 0.1);
            color: #86efac;
            border: 1px solid rgba(34, 197, 94, 0.2);
        }
    </style>
</head>
<body>

    <div class="login-container">
        <div class="header">
            <h1>Sistem Login</h1>
            <p>Masukkan kredensial Anda untuk melanjutkan</p>
        </div>

        <?php if ($error): ?>
            <div class="alert alert-error">
                <?php echo htmlspecialchars($error); ?>
            </div>
        <?php endif; ?>

        <?php if ($success): ?>
            <div class="alert alert-success">
                <?php echo $success; ?>
            </div>
        <?php endif; ?>

        <form method="POST" action="">
            <div class="form-group">
                <label for="username">Username</label>
                <!-- Default Username is set here -->
                <input type="text" id="username" name="username" class="form-control" value="Jamkes2" required autocomplete="off">
            </div>

            <div class="form-group">
                <label for="password">Password</label>
                <!-- Default Password is set here -->
                <input type="password" id="password" name="password" class="form-control" value="Kemenkes2026" required>
            </div>

            <div class="form-group">
                <label>Verifikasi Keamanan (Captcha)</label>
                <div class="captcha-container">
                    <span class="captcha-text"><?php echo $_SESSION['captcha_text']; ?> = ?</span>
                    <input type="number" name="captcha" class="form-control captcha-input" placeholder="Hasil" required>
                </div>
            </div>

            <button type="submit" class="btn-submit">Masuk Sekarang</button>
        </form>
    </div>

</body>
</html>
