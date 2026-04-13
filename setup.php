<?php
// setup.php — Secure first-run setup
// Only runs when SETUP_ENABLED=true in .env AND correct token is provided.

declare(strict_types=1);

// Load .env
$envFile = __DIR__ . '/.env';
if (file_exists($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (str_starts_with(trim($line), '#') || !str_contains($line, '=')) continue;
        [$k, $v] = explode('=', $line, 2);
        $_ENV[trim($k)] = trim($v);
    }
}

$setupEnabled = filter_var($_ENV['SETUP_ENABLED'] ?? 'false', FILTER_VALIDATE_BOOLEAN);
$setupToken   = $_ENV['SETUP_TOKEN'] ?? '';

header('Content-Type: text/html; charset=utf-8');

if (!$setupEnabled) {
    http_response_code(403);
    die('<h2>⛔ Setup is disabled. Set SETUP_ENABLED=true in .env to enable.</h2>');
}

$tokenOk = ($_GET['token'] ?? '') === $setupToken || ($_POST['token'] ?? '') === $setupToken;
$message  = '';
$error    = '';
$done     = false;

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $tokenOk) {
    require_once __DIR__ . '/backend/config/database.php';

    try {
        $pdo = Database::getConnection();

        // Read and execute schema
        $sql = file_get_contents(__DIR__ . '/database/schema.sql');
        $statements = array_filter(array_map('trim', explode(';', $sql)));
        foreach ($statements as $stmt) {
            if (!empty($stmt)) $pdo->exec($stmt);
        }

        $message = '✅ Database schema installed successfully! Default admin: <strong>admin@digital8x.site</strong> / <strong>Admin@Lead8X</strong>';
        $done    = true;
    } catch (\Throwable $e) {
        $error = '❌ Setup failed: ' . htmlspecialchars($e->getMessage());
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lead8X Setup</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0f0f1a; color: #e0e0e0; font-family: 'Segoe UI', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  .card { background: #1a1a2e; border-radius: 16px; padding: 40px; width: 100%; max-width: 460px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
  h1 { font-size: 1.8rem; color: #7c3aed; margin-bottom: 8px; }
  p.sub { color: #888; font-size: .9rem; margin-bottom: 24px; }
  label { display: block; font-size: .85rem; color: #aaa; margin-bottom: 6px; }
  input { width: 100%; padding: 12px 16px; border-radius: 8px; border: 1px solid #333; background: #0f0f1a; color: #fff; font-size: 1rem; margin-bottom: 20px; }
  button { width: 100%; padding: 14px; background: linear-gradient(135deg,#7c3aed,#a855f7); border: none; border-radius: 8px; color: #fff; font-size: 1rem; font-weight: 600; cursor: pointer; }
  .msg  { padding: 14px; border-radius: 8px; margin-bottom: 20px; background: #1e3a2e; color: #4ade80; font-size: .9rem; }
  .err  { background: #3a1e1e; color: #f87171; }
  .warn { background: #2a1a0a; color: #fb923c; padding: 12px; border-radius: 8px; font-size: .8rem; margin-bottom: 20px; }
</style>
</head>
<body>
<div class="card">
  <h1>🚀 Lead8X Setup</h1>
  <p class="sub">This runs the database schema installation. Run once, then set <code>SETUP_ENABLED=false</code>.</p>

  <?php if ($message): ?><div class="msg"><?= $message ?></div><?php endif; ?>
  <?php if ($error):   ?><div class="msg err"><?= $error ?></div><?php endif; ?>

  <?php if (!$done): ?>
    <?php if (!$tokenOk): ?>
      <div class="warn">⚠️ Provide the correct setup token via <code>?token=YOUR_TOKEN</code> in the URL.</div>
    <?php else: ?>
      <div class="warn">⚠️ This will create all tables in the database. Existing data is safe (IF NOT EXISTS).</div>
      <form method="POST">
        <input type="hidden" name="token" value="<?= htmlspecialchars($_GET['token'] ?? '') ?>">
        <button type="submit">▶ Run Database Setup</button>
      </form>
    <?php endif; ?>
  <?php else: ?>
    <p style="color:#888;font-size:.85rem;margin-top:16px;">⚠️ IMPORTANT: Set <strong>SETUP_ENABLED=false</strong> in your .env file now!</p>
    <a href="/" style="display:block;margin-top:16px;text-align:center;color:#7c3aed;">→ Go to Application</a>
  <?php endif; ?>
</div>
</body>
</html>
