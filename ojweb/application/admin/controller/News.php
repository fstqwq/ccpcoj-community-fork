<?php
namespace app\admin\controller;
use think\Controller;
use app\common\traits\NewsBaseTrait;

class News extends Adminbase
{
	use NewsBaseTrait;
	
	//***************************************************************//
	//News
	//***************************************************************//
	var $staticPage;
	var $maxTag;
	var $tagLength;
	public function initialize()
	{
		$this->OJMode();
		$this->AdminInit();
		$this->staticPage 		= config('CsgcpcConst.STATIC_PAGE');
		$this->maxTag 			= config('CsgcpcConst.MAX_TAG');
		$this->tagLength 		= config('CsgcpcConst.TAG_LENGTH');

		$this->assign([
			'staticPage' 	=> $this->staticPage,
			'maxTag'		=> $this->maxTag,
			'tagLengh'		=> $this->tagLength,
		]);
	}
	public function index()
	{
		return $this->fetch();
	}
	public function news_list_ajax()
	{
		$columns = ['news_id', 'user_id', 'category', 'title', 'time', 'defunct', 'tags'];
		$offset		= intval(input('offset'));
		$limit		= intval(input('limit'));
		$sort		= trim(input('sort'));
		$sort       = validate_item_range($sort, $columns);
		$order		= input('order');
		$search		= trim(input('search/s'));
		
		// 新增筛选参数
		$category_filter = input('category', -1);
		$defunct_filter = input('defunct', -1);
		// 兼容前端传空字符串：视为“不筛选”
		if ($category_filter === '') $category_filter = -1;
		if ($defunct_filter === '') $defunct_filter = -1;

		// TP5.1：统一使用“二维条件数组”形式，避免 ['field'=>['>=',...]] 这种 TP5.0 风格写法
		$map = [
			['news_id', '>=', 1000]
		];
		if(strlen($search) > 0)
			$map[] = ['news_id|user_id|title|category', 'like', "%$search%"];
			
		// 添加category筛选
		if($category_filter != -1) {
			$map[] = ['category', '=', $category_filter];
		}
		
		// 添加defunct筛选
		if($defunct_filter != -1) {
			$map[] = ['defunct', '=', $defunct_filter];
		}
		
		$ordertype = [];
		if(strlen($sort) > 0)
		{
			$ordertype = [
				$sort => $order
			];
		}
		
		// 通过钩子获取新闻列表（exadmin 可以重写此方法处理特殊逻辑）
		$newsList = $this->getNewsList($map, $category_filter, $columns, $ordertype, $offset, $limit);
		
		foreach($newsList as &$news) {
			if(PrivItem($this->privilegeStr, $news['news_id'], 'admin')) {
				$news['is_admin'] = true; // 有权限管理该新闻
			}
			else {
				$news['is_admin'] = false;
			}
		}
		
		// 计算总数
		$total_map = [];
		if(strlen($search) > 0) {
			$total_map[] = ['news_id|user_id|title|category', 'like', "%$search%"];
		}
		if($category_filter != -1) {
			$total_map[] = ['category', '=', $category_filter];
		}
		if($defunct_filter != -1) {
			$total_map[] = ['defunct', '=', $defunct_filter];
		}
		$total_map[] = ['news_id', '>=', 1000];
		
		// 通过钩子获取总数（exadmin 可以重写此方法处理特殊逻辑）
		$total = $this->getNewsListTotal($total_map, $category_filter);
		
		$ret = [];
		$ret['order'] = $order;
		$ret['rows'] = $newsList;
		$ret['total'] = $total;
		
		// 如果是 AJAX 请求，返回 JSON 格式
		if (request()->isAjax()) {
			return json($ret);
		}
		
		return $ret;
	}
	
	/**
	 * 钩子方法：获取新闻列表
	 * exadmin 可以重写此方法处理 exp 相关的特殊逻辑（如 course_key 筛选、合并查询等）
	 * @param array $map 查询条件
	 * @param int $category_filter 分类筛选（-1 表示全部）
	 * @param array $columns 查询字段
	 * @param array $ordertype 排序条件
	 * @param int $offset 偏移量
	 * @param int $limit 限制数量
	 * @return array 新闻列表
	 */
	protected function getNewsList($map, $category_filter, $columns, $ordertype, $offset, $limit)
	{
		// admin 模块：简单查询，通过 applyQueryFilterToQuery hook 让 exadmin 注入 course_key 过滤
		$NewsQuery = $this->applyQueryFilterToQuery(db('news'), $map, 'news');
		return $NewsQuery
			->field(implode(",", $columns))
			->order($ordertype)
			->limit($offset, $limit)
			->select();
	}
	
	/**
	 * 钩子方法：获取新闻列表总数
	 * exadmin 可以重写此方法处理 exp 相关的特殊逻辑（如合并统计等）
	 * @param array $total_map 查询条件
	 * @param int $category_filter 分类筛选（-1 表示全部）
	 * @return int 总数
	 */
	protected function getNewsListTotal($total_map, $category_filter)
	{
		// admin 模块：简单统计，通过 applyQueryFilterToQuery hook 让 exadmin 注入 course_key 过滤
		$NewsTotal = $this->applyQueryFilterToQuery(db('news'), $total_map, 'news');
		return $NewsTotal->count();
	}
	public function news_add()
	{
		$this->assign([
			'edit_mode' => false,
			'copy_mode' => false,
		]);
		return $this->fetch('news_edit');
	}
	public function news_add_ajax()
	{
		$ret = $this->news_addedit_ajax_process();
		$news_add = $ret[0];
		$news_md_add = $ret[1];
		
		// 验证分类（添加时必须）
		if(!array_key_exists('category', $news_add) || empty($news_add['category']))
			$this->error("Category is required.");
		
		// 验证标题（添加时必须）
		if(!array_key_exists('title', $news_add) || empty($news_add['title']))
			$this->error("Title is required.");
		
		// 准备添加的默认数据
		$news_add = $this->prepareNewsAddData($news_add);
		
		// admin 模块：不应用 course_key 逻辑（通过 hook 让 exadmin 注入）
		$news_add = $this->prepareInsertData($news_add, 'news');
		$news_id = null;
		if(!($news_id = db('news')->insertGetId($news_add)))
		{
			$this->error('Add news failed, SQL error.');
		}
		
		// 插入后处理（通过 hook 让 exadmin 注入 course_item 映射）
		$this->afterInsertData($news_add, 'news', $news_id);
		
		// news已插入，下面处理news_md
		$this->saveNewsMd($news_id, $news_md_add);
		$this->AddPrivilege(session('user_id'), 'news', $news_id);
		
		$this->success('News successfully added.', '', ['id' => $news_id]);
	}
	public function news_edit()
	{
		$news_id = trim(input('id'));
		if(!PrivItem($this->privilegeStr, $news_id, 'admin'))
		{
			$this->error('Powerless');
		}
		$news = db('news')->where('news_id', $news_id)->find();
		if($news == null)
		{
			$this->error('No such news.');
		}
		// 验证资源归属（通过 hook 让 exadmin 注入 course_key 验证）
		$this->validateItemBelong($news, 'news');
		$news_md = db('news_md')->where('news_id', $news_id)->find();
		if($news_md != null)
		{
			$news = array_replace($news, $news_md);
		}
		$this->assign([
			'news' => $news,
            'item_priv'     => PrivItem($this->privilegeStr, $news_id, 'admin'),
			'edit_mode' => true,
			'copy_mode' => false,
			'action' => 'news_edit',
		]);
		return $this->fetch();
	}
	public function news_edit_ajax()
	{
		$news_id = trim(input('news_id'));
		if(!PrivItem($this->privilegeStr, $news_id, 'admin'))
		{
			$this->error('You cannot edit news ' . $news_id);
		}
		$news = db('news')->where('news_id', $news_id)->find();
		if($news == null)
		{
			$this->error('No such news.');
		}
		// 验证资源归属（通过 hook 让 exadmin 注入 course_key 验证）
		$this->validateItemBelong($news, 'news');
		
		$ret = $this->news_addedit_ajax_process();
		$news_edit = $ret[0];
		$news_md_edit = $ret[1];
		
		// 如果修改了分类，检查新分类的权限
		if(isset($news_edit['category']) && $news_edit['category'] != $news['category']) {
			if(!$this->canSetNewsCategory($news_edit['category'])) {
				$this->error("You don't have permission to change to this category");
			}
		}
		
		// 合并原有数据
		$news_update = array_replace($news, $news_edit);
		// admin 模块：不应用 course_key 逻辑（通过 hook 让 exadmin 注入）
		// 应用更新数据钩子（如果需要）
		$news_update = $this->prepareUpdateData($news_update, 'news');
		$news_update['news_id'] = $news_id; // 确保news_id不被覆盖
		$news_update = $this->prepareNewsUpdateData($news_update);
		
		// 保存 news_md
		$this->saveNewsMd($news_id, $news_md_edit);
		//更新news表，保存md编译的html
		$affected = db('news')->update($news_update);
		if(!$affected)
		{
			$this->error('Not updated (datas are the same).');
			return;
		}
		$this->success('Successfully modified.', '', []);
	}
	//***************************************************************//
	// Carousel
	//***************************************************************//
	public function carousel()
	{
		if(!IsAdmin('administrator'))
			$this->error("You cannot modify carousel");
		$ret = SetCarousel();
		$carouselConfig = config('CsgcpcConst.CAROUSEL');
		$this->assign($ret);
		$this->assign('carouselItem', $carouselConfig['carouselItem']);
		$this->assign('carouselFieldHelp', self::carouselAdminFieldHelp());
		return $this->fetch();
	}

	/** 轮播编辑页字段文案（与 CsgcpcConst.CAROUSEL.carouselItem 顺序无关，按键取值） */
	protected static function carouselAdminFieldHelp()
	{
		return [
			'href' => [
				'label_cn' => '跳转链接',
				'label_en' => 'Target URL',
				'hint_cn' => '点击幻灯片时打开的链接，可留空。',
				'hint_en' => 'URL when the slide is clicked; optional.',
			],
			'src' => [
				'label_cn' => '图片地址',
				'label_en' => 'Image URL',
				'hint_cn' => '建议使用附件或站内静态资源路径。',
				'hint_en' => 'Prefer attachments or static paths.',
			],
			'header' => [
				'label_cn' => '标题',
				'label_en' => 'Heading',
				'hint_cn' => '幻灯片主标题。',
				'hint_en' => 'Main heading on the slide.',
			],
			'content' => [
				'label_cn' => '摘要',
				'label_en' => 'Caption',
				'hint_cn' => '副标题或简短说明。',
				'hint_en' => 'Subtitle or short caption.',
			],
		];
	}

	public function carousel_ajax()
	{
		if(!IsAdmin('administrator'))
			$this->error("You cannot modify carousel");
		$ret = SetCarousel();
		$post = input('post.');
		$carousel = [
			'href' => [],
			'src' => [],
			'header' => [],
			'content' => [],
		];
		for($i = 0; $i < 3; $i ++)
		{
			$carousel['href'][] 	= $post['href' . $i];
			$carousel['src'][] 		= $post['src' . $i];
			$carousel['header'][]	= $post['header' . $i];
			$carousel['content'][] 	= $post['content' . $i];
		}
		$ret['news']['content'] = json_encode($carousel);
		$show = isset($post['show_carousel']) && strval($post['show_carousel']) === '1';
		$ret['news']['defunct'] = $show ? '0' : '1';

		db('news')->update($ret['news']);
		$this->success('Carousel updated');
	}
	//***************************************************************//
	// About Us
	//***************************************************************//
	public function SpecialNewInit($id, $title)
	{
		$news = db('news')->where('news_id', $id)->find();
		if(!$news)
		{
			$news = [
				'news_id'			=> $id,
				'title'				=> $title,
				'category'			=> 'about',
				'content'			=> '',
				// 默认隐藏，避免首次创建时未设置 defunct 导致模板读取报错
				'defunct'			=> '1',
				'user_id'			=> session('user_id'),
				'modify_user_id'	=> session('user_id'),
				'time'				=> date('Y-m-d H:i:s'),
				'modify_time'		=> date('Y-m-d H:i:s'),
			];
			db('news')->insert($news);
		}
		$news_md = db('news_md')->where('news_id', $news['news_id'])->find();
		if($news_md != null)
		{
			$news = array_replace($news, $news_md);
		}
		return $news;
	}
	public function aboutus()
	{
		if(!IsAdmin('administrator'))
			$this->error('You cannot update about us');
//        $title = 'About Us';
        $title = 'About';
		$news = $this->SpecialNewInit($this->staticPage['about_us'], $title);
		$this->assign([
			'news' 			=> $news,
			'special_page'	=> true,
			'title' 			=> $title,
			'aimurl'		=> '/index/about',
			'edit_mode' => false,
			'copy_mode' => false,
		]);
		return $this->fetch('news/news_edit');
	}
	//***************************************************************//
	// OJ F.A.Qs
	//***************************************************************//
	public function oj_faq()
	{
		if(!IsAdmin('administrator'))
			$this->error('You cannot update OJ F.A.Qs');
		
		// 获取当前编辑的语言版本
		$lang = input('lang', 'cn');
		$is_cn = ($lang == 'cn');

		// 兼容：旧配置可能没有 oj_faq_cn/oj_faq_other（避免未更新配置时报错）
		if (!is_array($this->staticPage)) {
			$this->staticPage = [];
		}
		$faq_cn_id = $this->staticPage['oj_faq_cn'] ?? ($this->staticPage['oj_faq'] ?? 20);
		$faq_other_id = $this->staticPage['oj_faq_other'] ?? 21;
		
		// 根据语言版本选择对应的 news_id 和标题
		if($is_cn) {
			$news_id = $faq_cn_id;
			$title = '常见疑问';
		} else {
			$news_id = $faq_other_id;
			$title = 'F.A.Qs';
		}
		
		$news = $this->SpecialNewInit($news_id, $title);
		
		// 获取另一个语言版本，用于显示切换标签
		$other_news_id = $is_cn ? $faq_other_id : $faq_cn_id;
		$other_news = db('news')->where('news_id', $other_news_id)->find();
		
		$this->assign([
			'news' 			=> $news,
			'other_news'	=> $other_news,
			'current_lang'	=> $lang,
			'special_page'	=> true,
			'is_faq_page'	=> true,
			'title' 		=> $title,
			'aimurl'		=> '/csgoj/faqs',
			'edit_mode' 	=> false,
			'copy_mode' 	=> false,
		]);
		return $this->fetch('news/news_edit');
	}
}
