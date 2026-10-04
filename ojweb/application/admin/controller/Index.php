<?php
namespace app\admin\controller;
use think\Controller;
use think\Db;
class Index extends Adminbase
{
	public function index()
	{
		$module = $this->request->module();
		// 支持的资源类型：problem、contest、news
		$supported_items = ['problem', 'contest', 'news'];
		foreach($supported_items as $item)
		{
			$privilege_name = $item . '_editor';  // problem_editor, contest_editor, news_editor
			if(IsAdmin($privilege_name))
			{
				$this->redirect('/'.$module.'/' . $item);
			}
		}
		if(IsAdmin('administrator'))
			$this->redirect('/'.$module.'/news');
		$this->error('You are not an administrator', '/', '', 2);
	}

    public function ReInitSpj()
    {
        if(!IsAdmin('super_admin'))
            $this->error('Powerless');
        $this->DoReInitSpj('/home/judge/data');
        exit();
    }
    public function DoReInitSpj($path)
    {
        if(!IsAdmin('super_admin'))
            $this->error('Powerless');

        if (is_dir($path) && ($handle = opendir($path)))
        {
            while (($file = readdir($handle)) !== false)
            {
                if ($file!="." && $file!="..")
                {
                    if(is_dir($path . '/' . $file)) {
                        $this->DoReInitSpj($path . '/' . $file);
                    }
                    else if($file == 'spj')
                    {
                        dump($path);
                        // 使用 PHP 的 chmod() 替代 exec("chmod")，因为 exec 可能被禁用
                        $filePath = $path . '/' . $file;
                        if (file_exists($filePath)) {
                            chmod($filePath, 0755); // 755 = rwxr-xr-x (可执行)
                        }
                    }
                }
            }
            //关闭句柄
            closedir ( $handle );
        }
        else
        {
            return false;
        }
        return true;
    }
}
