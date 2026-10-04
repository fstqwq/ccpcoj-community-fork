<?php
// Called once per container start; existing accounts are never changed or promoted.
if (PHP_SAPI !== 'cli') exit(1);
$pdo = new PDO('mysql:host='.getenv('DB_HOSTNAME').';port='.(getenv('DB_HOSTPORT') ?: 3306).';dbname='.getenv('DB_DATABASE').';charset=utf8mb4', getenv('DB_USERNAME'), getenv('DB_PASSWORD'), [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
foreach (['admin'=>['ADMIN_PASSWORD','super_admin'], 'judger'=>['JUDGER_PASSWORD','judger']] as $user=>$spec) {
    $password = getenv($spec[0]);
    if (!$password) continue;
    if (strlen($password) < 16) throw new RuntimeException($spec[0].' must contain at least 16 characters');
    $pdo->beginTransaction();
    try {
        $find = $pdo->prepare('SELECT user_id FROM users WHERE user_id=?'); $find->execute([$user]);
        if ($find->fetchColumn() === false) {
            $insert = $pdo->prepare('INSERT INTO users(user_id,password,nick,school,ip,reg_time,defunct,language) VALUES(?,?,?,?,?,NOW(),?,?)');
            // Judge language is a bitmask; 0 means all enabled languages.
            $insert->execute([$user,password_hash($password,PASSWORD_DEFAULT),$user,'','127.0.0.1','0',$user === 'judger' ? 0 : 1]);
            $grant = $pdo->prepare('INSERT INTO privilege(user_id,pvrole,defunct) VALUES(?,?,?)'); $grant->execute([$user,$spec[1],'0']);
            echo 'Created account: '.$user."\n";
        }
        $pdo->commit();
    } catch (Throwable $e) { $pdo->rollBack(); throw $e; }
}
