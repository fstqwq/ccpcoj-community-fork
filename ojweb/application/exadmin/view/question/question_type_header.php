<!-- question_type_header 已移至 question_edit.php 的 admin-page-header 中 -->
<ul class="nav nav-pills nav-fill csg-question-type-nav">
  <li class="nav-item"><a class="nav-link li_pkind {if isset($pkind) && $pkind != 0} disabled{/if} {if !isset($pkind) ||$pkind==0}active{/if}" href="#" 	pkind=0	>单选<span class="en-text">SingleChoice</span></a></li>
  <li class="nav-item"><a class="nav-link li_pkind {if isset($pkind) && $pkind != 1} disabled{/if} {if isset($pkind) && $pkind==1}active{/if}" href="#" 	pkind=1	>多选<span class="en-text">MultiChoice</span></a></li>
  <li class="nav-item"><a class="nav-link li_pkind {if isset($pkind) && $pkind != 5} disabled{/if} {if isset($pkind) && $pkind==5}active{/if}"  href="#" 	pkind=5	>判断<span class="en-text">TrueFalse</span></a></li>
  <li class="nav-item"><a class="nav-link li_pkind {if isset($pkind) && $pkind != 10}disabled{/if} {if isset($pkind) && $pkind==10}active{/if}" href="#" 	pkind=10>填空<span class="en-text">Fill</span></a></li>
  <li class="nav-item"><a class="nav-link li_pkind {if isset($pkind) && $pkind != 15}disabled{/if} {if isset($pkind) && $pkind==15}active{/if}" href="#" 	pkind=15>简答<span class="en-text">ShortAnswer</span></a></li>
  <li class="nav-item"><a class="nav-link li_pkind {if isset($pkind) && $pkind != 20}disabled{/if} {if isset($pkind) && $pkind==20}active{/if}" href="#" 	pkind=20>综合<span class="en-text">Comprehensive</span></a></li>
  <li class="nav-item"><a class="nav-link li_pkind {if isset($pkind) && $pkind != 25}disabled{/if} {if isset($pkind) && $pkind==25}active{/if}" href="#" 	pkind=25>编程<span class="en-text">Programming</span></a></li>
</ul>
<input type="hidden" id='page_info' edit_mode="{if $edit_mode}1{else/}0{/if}" init_pkind="{if $edit_mode}{$question['pkind']}{else/}0{/if}" >

