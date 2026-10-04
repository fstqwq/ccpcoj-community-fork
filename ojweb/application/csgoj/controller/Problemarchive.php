<?php
namespace app\csgoj\controller;
use think\Controller;
use think\Db;
class Problemarchive extends Csgojbase {

    public function initialize()
    {
        $this->OJMode();
        $this->assign(['pagetitle' => 'Problem Archive']);
    }
    public function index() {
        $this->assign([
            'page_title' => '赛事题目归档',
            'page_title_en' => 'Problem Archive',
            'search_placeholder' => '来源/作者',
        ]);
        return $this->fetch();
    }
    public function problemarchive_ajax() {
        $cacheKey = 'problemarchive_grouped';
        $cached = cache($cacheKey);
        if ($cached !== false && $cached !== null) {
            return $cached;
        }

        $rows = db('problem')->where('archived', 1)
            ->field('source, in_date, author')
            ->order('in_date', 'desc')
            ->select();
        // 按 trim 后的 source 分组，同来源仅显示一行（ThinkPHP group(Db::raw()) 会报错，故在 PHP 中分组）
        $grouped = [];
        foreach ($rows as $row) {
            $key = trim($row['source'] ?? '');
            if (!isset($grouped[$key])) {
                $grouped[$key] = [
                    'source'  => $key,
                    'in_date' => $row['in_date'],
                    'author'  => [],
                ];
            }
            if (!empty($row['author'])) {
                $author = trim(preg_replace('/<[^>]+>/', '', $row['author']));
                if ($author !== '' && !in_array($author, $grouped[$key]['author'], true)) {
                    $grouped[$key]['author'][] = $author;
                }
            }
            // 同来源取最早 in_date
            if ($row['in_date'] !== null && ($grouped[$key]['in_date'] === null || $row['in_date'] < $grouped[$key]['in_date'])) {
                $grouped[$key]['in_date'] = $row['in_date'];
            }
        }
        foreach ($grouped as &$item) {
            $item['author'] = implode(', ', $item['author']);
        }
        unset($item);
        usort($grouped, function ($a, $b) {
            $da = $a['in_date'] ?? '';
            $db = $b['in_date'] ?? '';
            return $db <=> $da; // 降序
        });

        cache($cacheKey, $grouped, 60);
        return $grouped;
    }
}
