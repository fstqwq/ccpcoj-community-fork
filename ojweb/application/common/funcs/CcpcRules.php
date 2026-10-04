<?php
namespace app\common\funcs;

/** CCPC 2026-09-14. Pure rules: no database, cache, session or system clock. */
final class CcpcRules
{
    public static function enabled(array $contest): bool
    {
        return ($contest['contest_rank_kind'] ?? 'icpc') === 'ccpc';
    }

    public static function settings(array $post, array $previous = []): array
    {
        $kind = $post['contest_rank_kind'] ?? $previous['contest_rank_kind'] ?? 'icpc';
        $policy = $post['ccpc_reveal_policy'] ?? $previous['ccpc_reveal_policy'] ?? 'min_50_20';
        if (!in_array($kind, ['icpc','ccpc'], true)) throw new \InvalidArgumentException('Invalid contest rank kind');
        self::threshold(0, $policy);
        $out = ['contest_rank_kind'=>$kind,'ccpc_reveal_policy'=>$policy];
        if ($kind === 'ccpc') $out['frozen_minute'] = 60;
        return $out;
    }

    public static function palette(): array
    {
        $file = getenv('CCPC_PALETTE_FILE') ?: dirname(__DIR__, 3) . '/config/ccpc_palette.json';
        $value = json_decode(file_get_contents($file), true);
        if (!is_array($value)) throw new \RuntimeException('Invalid CCPC palette JSON');
        return $value;
    }

    public static function threshold(int $teams, string $policy = 'min_50_20'): int
    {
        $ratio = max(1, intdiv(max(0, $teams), 5));
        if ($policy === 'fixed_50') return 50;
        if ($policy === 'ratio_20') return $ratio;
        if ($policy !== 'min_50_20') throw new \InvalidArgumentException('Invalid CCPC reveal policy');
        return min(50, $ratio);
    }

    public static function freezeAt(array $contest): int
    {
        return max(strtotime($contest['start_time']), strtotime($contest['end_time']) - 3600);
    }

    public static function teamId($id, $cid): string
    {
        $id = (string) $id;
        $prefix = '#cpc' . $cid . '_';
        return strpos($id, $prefix) === 0 ? substr($id, strlen($prefix)) : $id;
    }

    public static function letter(int $num): string
    {
        $out = '';
        for ($n = $num + 1; $n > 0; $n = intdiv($n - 1, 26)) $out = chr(65 + ($n - 1) % 26) . $out;
        return $out;
    }

    private static function clock(int $seconds): string
    {
        return sprintf('%02d:%02d:%02d', intdiv($seconds, 3600), intdiv($seconds % 3600, 60), $seconds % 60);
    }

    private static function secret(string $secret): void
    {
        if (strlen($secret) < 32) throw new \RuntimeException('CCPC_HMAC_KEY must contain at least 32 characters');
    }

    /** Normalize the original 2.0.40 compact rank wire format. */
    public static function normalize(array $data): array
    {
        $cid = $data['contest']['contest_id'];
        $problems = [];
        foreach ($data['problem'] ?? [] as $p) {
            if (array_key_exists(0, $p)) $p = array_combine(['problem_id','title','num','color','pscore'], array_slice(array_pad($p, 5, ''), 0, 5));
            $problems[(string) $p['problem_id']] = $p;
        }
        uasort($problems, function ($a, $b) { return (int)$a['num'] <=> (int)$b['num']; });
        $teams = [];
        foreach ($data['team'] ?? [] as $t) {
            if (array_key_exists(0, $t)) $t = array_combine(['contest_id','team_id','name','name_en','coach','tmember','school','region','tkind','room','privilege','team_global_code','group_ids','group_ids_explicit'], array_slice(array_pad($t, 14, ''), 0, 14));
            if (!empty($t['privilege'])) continue;
            $t['team_id'] = self::teamId($t['team_id'], $cid);
            $teams[$t['team_id']] = $t;
        }
        $solutions = [];
        foreach ($data['solution'] ?? [] as $s) {
            if (array_key_exists(0, $s)) $s = array_combine(['solution_id','contest_id','problem_id','team_id','result','in_date'], array_slice($s, 0, 6));
            $s['team_id'] = self::teamId($s['team_id'] ?? $s['user_id'], $cid);
            $s['result'] = (int)$s['result'];
            $s['_time'] = strtotime($s['in_date']);
            if ((string)$s['contest_id'] !== (string)$cid || !isset($teams[$s['team_id']], $problems[$s['problem_id']]) || $s['_time'] === false) continue;
            $solutions[] = $s;
        }
        usort($solutions, function ($a, $b) { return ($a['_time'] <=> $b['_time']) ?: ((int)$a['solution_id'] <=> (int)$b['solution_id']); });
        return [$problems, $teams, $solutions];
    }

    /** Ignore every submission after the first real AC BEFORE masking frozen verdicts. */
    public static function eligible(array $solutions, array $contest, int $now): array
    {
        $start = strtotime($contest['start_time']);
        $end = strtotime($contest['end_time']);
        $accepted = [];
        $out = [];
        foreach ($solutions as $s) {
            if ($s['_time'] < $start || $s['_time'] >= $end || $s['_time'] > $now) continue;
            $tid = $s['team_id']; $pid = $s['problem_id'];
            if (isset($accepted[$tid][$pid])) continue;
            // 0..3 pending, 4 AC, 5..10 penalty verdicts. CE(11)/system errors do not count.
            if ($s['result'] < 0 || $s['result'] > 10) continue;
            $out[] = $s;
            if ($s['result'] === 4) $accepted[$tid][$pid] = true;
        }
        return $out;
    }

    /** Public snapshot. Hidden problem IDs/labels, raw submissions and global colors never leave the server. */
    public static function project(array $data, int $now, string $secret): array
    {
        self::secret($secret);
        $contest = $data['contest'];
        [$problems, $teams, $solutions] = self::normalize($data);
        $solutions = self::eligible($solutions, $contest, $now);
        $start = strtotime($contest['start_time']);
        $freeze = self::freezeAt($contest);
        $end = strtotime($contest['end_time']);
        $frozen = $now >= $freeze && $now < $end + max(0, (int)($contest['frozen_after'] ?? 0)) * 60;
        $showAll = $now >= $freeze;
        $threshold = self::threshold(count($teams), $contest['ccpc_reveal_policy'] ?? 'min_50_20');
        $stats = []; $acTeams = []; $first = ['global' => [], 'regular' => []];
        foreach ($teams as $tid => $team) foreach ($problems as $pid => $p) {
            $stats[$tid][$pid] = ['status'=>'none','submitCount'=>0,'lastSubmitTime'=>'','_ac'=>null,'_last'=>null,'_wrong'=>0];
        }
        foreach ($solutions as $s) {
            $tid = $s['team_id']; $pid = $s['problem_id']; $t = $s['_time'];
            $st = &$stats[$tid][$pid];
            $st['submitCount']++;
            $st['_last'] = $t;
            $st['lastSubmitTime'] = self::clock($t - $start);
            if (($frozen && $t >= $freeze) || $s['result'] < 4) {
                $st['status'] = 'pending';
            } elseif ($s['result'] === 4) {
                $st['status'] = 'ac'; $st['_ac'] = $t;
                $acTeams[$pid][$tid] = true;
                $fb = ['team_id'=>(string)$tid,'in_date'=>$s['in_date'],'isStarTeam'=>(int)($teams[$tid]['tkind'] ?? 0) === 2];
                if (!isset($first['global'][$pid])) $first['global'][$pid] = $fb;
                if (!$fb['isStarTeam'] && !isset($first['regular'][$pid])) $first['regular'][$pid] = $fb;
            } else {
                $st['_wrong']++;
                if ($st['status'] !== 'pending') $st['status'] = 'wa';
            }
            unset($st);
        }
        $revealed = [];
        foreach ($problems as $pid => $p) if ($showAll || count($acTeams[$pid] ?? []) >= $threshold) $revealed[$pid] = true;
        $rows = []; $problemStats = [];
        foreach ($teams as $tid => $team) {
            $ordered = array_keys($problems);
            usort($ordered, function ($a, $b) use ($revealed, $stats, $tid, $problems) {
                $sa = $stats[$tid][$a]; $sb = $stats[$tid][$b];
                $ca = isset($revealed[$a]) ? 0 : ($sa['_ac'] !== null ? 1 : ($sa['_last'] !== null ? 2 : 3));
                $cb = isset($revealed[$b]) ? 0 : ($sb['_ac'] !== null ? 1 : ($sb['_last'] !== null ? 2 : 3));
                if ($ca !== $cb) return $ca <=> $cb;
                if ($ca === 1 && $sa['_ac'] !== $sb['_ac']) return $sa['_ac'] <=> $sb['_ac'];
                if ($ca === 2 && $sa['_last'] !== $sb['_last']) return $sa['_last'] <=> $sb['_last'];
                return (int)$problems[$a]['num'] <=> (int)$problems[$b]['num'];
            });
            $row = ['item_key'=>(string)$tid,'team_id'=>(string)$tid,'solved'=>0,'penalty'=>0,'problemStats'=>[],'problemOrder'=>[]];
            foreach ($ordered as $pid) {
                $st = $stats[$tid][$pid];
                if ($st['_ac'] !== null) { $row['solved']++; $row['penalty'] += $st['_ac'] - $start + $st['_wrong'] * 1200; }
                $shown = isset($revealed[$pid]);
                $key = $shown ? (string)$pid : 'h_' . substr(hash_hmac('sha256', json_encode([$contest['contest_id'], (string)$tid, (string)$pid]), $secret), 0, 32);
                $st['problemAlphabetIdx'] = $shown ? self::letter((int)$problems[$pid]['num']) : '';
                $st['revealed'] = $shown;
                unset($st['_ac'], $st['_last'], $st['_wrong']);
                $row['problemStats'][$key] = $st;
                $row['problemOrder'][] = $key;
                if ($shown) {
                    if (!isset($problemStats[$pid])) $problemStats[$pid] = ['ac'=>0,'total'=>0,'acTeams'=>0,'totalTeams'=>0];
                    $problemStats[$pid]['ac'] += $st['status'] === 'ac' ? 1 : 0;
                    $problemStats[$pid]['acTeams'] += $st['status'] === 'ac' ? 1 : 0;
                    $problemStats[$pid]['total'] += $st['submitCount'];
                    $problemStats[$pid]['totalTeams'] += $st['submitCount'] > 0 ? 1 : 0;
                }
            }
            $rows[] = $row;
        }
        foreach (['notification','description','password','teachers','clss_id'] as $key) unset($contest[$key]);
        $contest['frozen_minute'] = 60;
        $data['contest'] = $contest;
        $data['problem'] = [];
        foreach ($problems as $pid => $p) if (isset($revealed[$pid])) $data['problem'][] = [$p['problem_id'], '', $p['num'], '', $p['pscore'] ?? 0];
        foreach ($first as &$scope) $scope = array_intersect_key($scope, $revealed);
        unset($scope);
        $data['solution'] = [];
        $data['contest_balloon'] = [];
        $data['ccpc_rows'] = $rows;
        $data['ccpc_meta'] = ['view'=>'public','threshold'=>$threshold,'team_count'=>count($teams),'problem_count'=>count($problems),'frozen_show_all'=>$showAll,'frozen'=>$frozen,'server_time'=>$now,'freeze_at'=>$freeze,'map_fb'=>$first,'problem_stats'=>$problemStats];
        unset($data['ccpc_balloon_assignments']);
        return $data;
    }

    /** Stable per-team permutation. The secret must be backed up and must not rotate during a contest. */
    public static function balloonAssignments(array $data, int $now, string $secret, array $palette): array
    {
        self::secret($secret);
        [$problems, $teams, $solutions] = self::normalize($data);
        $names = []; $colors = [];
        foreach ($palette as $c) {
            $name = trim((string)($c['name'] ?? ''));
            $color = strtolower((string)($c['color'] ?? ''));
            if ($name === '' || $name !== ($c['name'] ?? '') || strtoupper($name) === 'FB' || !preg_match('/^#[0-9a-f]{6}$/D', $color) || $color === '#000000') throw new \InvalidArgumentException('Invalid palette or reserved first-blood color');
            $names[] = $name; $colors[] = $color;
        }
        if (count($palette) < count($problems) || count(array_unique($names)) !== count($palette) || count(array_unique($colors)) !== count($palette)) throw new \InvalidArgumentException('CCPC palette needs a distinct color and name for every problem');
        $solutions = self::eligible($solutions, $data['contest'], $now);
        $freeze = self::freezeAt($data['contest']); $perTeam = []; $fb = []; $out = [];
        foreach ($solutions as $s) {
            if ($s['result'] !== 4 || $s['_time'] >= $freeze) continue;
            $tid = $s['team_id']; $pid = $s['problem_id'];
            if (!isset($perTeam[$tid])) {
                $colors = $palette;
                usort($colors, function ($a, $b) use ($secret, $data, $tid) {
                    $key = json_encode([$data['contest']['contest_id'], (string)$tid]);
                    return strcmp(hash_hmac('sha256', $key . ':' . $a['name'], $secret), hash_hmac('sha256', $key . ':' . $b['name'], $secret));
                });
                $perTeam[$tid] = array_combine(array_keys($problems), array_slice($colors, 0, count($problems)));
            }
            $first = !isset($fb[$pid]); $fb[$pid] = true;
            $out[(string)$s['solution_id']] = ['first_blood'=>$first,'label'=>$first ? 'FB' : $perTeam[$tid][$pid]['name'],'color'=>$first ? '#000000' : $perTeam[$tid][$pid]['color']];
        }
        return $out;
    }
}
