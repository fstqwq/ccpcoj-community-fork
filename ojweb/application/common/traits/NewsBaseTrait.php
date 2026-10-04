<?php
namespace app\common\traits;

/**
 * News 通用逻辑 Trait（所有模块共用）
 * 统一提供所有 News 相关的通用方法，供 admin、exadmin、index、exindex 模块复用
 * 注意：此 trait 不包含任何 course_key 相关逻辑，course_key 逻辑应在 NewsExpTrait 中实现
 */
trait NewsBaseTrait
{
    // ========== 后台管理相关方法（admin/exadmin 使用） ==========
    
    /**
     * 验证并处理标签列表
     * @param string $tags 标签字符串（分号分隔）
     * @return array 处理后的标签数组
     */
    protected function GetTagList($tags)
    {
        if(!isset($this->maxTag)) {
            $this->maxTag = config('CsgcpcConst.MAX_TAG');
        }
        if(!isset($this->tagLength)) {
            $this->tagLength = config('CsgcpcConst.TAG_LENGTH');
        }
        
        $tagList = explode(";", $tags);
        if(count($tagList) > $this->maxTag)
            $this->error("Too many tags");
        $ret = [];
        foreach($tagList as $tag)
        {
            $singleTag = trim($tag);
            if(strlen($singleTag) > $this->tagLength)
                $this->error('Tag '.$singleTag.' too long');
            if(strlen($singleTag) > 0)
                $ret[] = $singleTag;
        }
        return $ret;
    }
    
    /**
     * 处理新闻添加/编辑的通用逻辑
     * @return array [news_info, news_md_info] 返回处理后的新闻数据和 markdown 数据
     */
    protected function news_addedit_ajax_process()
    {
        $postData = input('post.');
        unset($postData['cooperator']); // cooperator需要额外处理，这里先排除
        $news_info = [];
        
        // 验证并处理分类（仅在添加时需要）
        if(array_key_exists('category', $postData) && !empty($postData['category'])) {
            $validCategories = ['news', 'notification', 'answer', 'cpcinfo'];
            if(!in_array($postData['category'], $validCategories))
                $this->error("Not a valid category");
            // 检查是否有权限设置该分类
            if(method_exists($this, 'canSetNewsCategory') && !$this->canSetNewsCategory($postData['category'])) {
                $this->error("You don't have permission to set this category");
            }
            $news_info['category'] = $postData['category'];
        }
        
        // 处理标题
        if(array_key_exists('title', $postData)) {
            $news_info['title'] = trim($postData['title']);
        }
        
        // 处理标签
        if(array_key_exists('tags', $postData)) {
            $tags = trim($postData['tags'], "; \0\x0B\r\t\n");
            // 验证标签格式
            $this->GetTagList($tags);
            $news_info['tags'] = $tags;
        }
        
        // 验证内容
        if(!array_key_exists('content', $postData))
            $this->error("Content is required.");
        
        $news_md_info = [
            'content'	=> 	$postData['content'],
        ];
        
        // 插入news表，描述字段为md编译的html
        $news_info['content'] = ParseMarkdown($news_md_info['content']);
        
        return [$news_info, $news_md_info];
    }
    
    /**
     * 保存 news_md 表数据
     * @param int $news_id 新闻ID
     * @param array $news_md_data news_md 表的数据
     * @return void
     */
    protected function saveNewsMd($news_id, $news_md_data)
    {
        $News_md = db('news_md');
        $news_md = $News_md->where('news_id', $news_id)->find();
        $news_md_data['news_id'] = $news_id; //注意news_md表要设置news_id以和news表对应。
        //虽然新插数据基本不会发生news_md已有此news_id的情况，但以防万一news表被删除过并修改过auto_increacement
        if($news_md == null) {
            $News_md->insert($news_md_data);
        }
        else {
            $News_md->update($news_md_data);
        }
    }
    
    /**
     * 准备新闻添加的默认数据
     * @param array $news_data 新闻数据（已包含分类、标题、内容等）
     * @return array 添加了默认字段的新闻数据
     */
    protected function prepareNewsAddData($news_data)
    {
        $news_data['defunct'] = '1'; //默认隐藏防泄漏
        $news_data['time'] = date('Y-m-d H:i:s');
        $news_data['user_id'] = session('user_id');
        $news_data['modify_time'] = $news_data['time'];
        $news_data['modify_user_id'] = $news_data['user_id'];
        $news_data['attach'] = $this->AttachFolderCalculation(session('user_id')); // 计算附件文件夹名称，固定后导入导出题目不会有路径变化问题
        
        return $news_data;
    }
    
    /**
     * 准备新闻更新的默认数据
     * @param array $news_data 新闻数据
     * @return array 添加了更新字段的新闻数据
     */
    protected function prepareNewsUpdateData($news_data)
    {
        $news_data['modify_time'] = date('Y-m-d H:i:s');
        $news_data['modify_user_id'] = session('user_id');
        
        return $news_data;
    }
}

