<?php
$hash = password_hash('Admin@Lead8X', PASSWORD_BCRYPT, ['cost' => 12]);
echo "Hash: " . $hash . "\n";
echo "Verify Correct: " . (password_verify('Admin@Lead8X', $hash) ? 'yes' : 'no') . "\n";
echo "Verify SQL Hash I sent: " . (password_verify('Admin@Lead8X', '$2y$12$1Y77m8z.pBIfZ2IofD6QeewFpXZ5eokp6t0z.b34S0Z306r8Y9JmS') ? 'yes' : 'no') . "\n";
