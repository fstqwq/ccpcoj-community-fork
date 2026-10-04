<div class="page-header">
    <h1>重测提交</h1>
</div>
<div class="container">
    {if($rejudge_type != 'contest')}
    <span class="alert alert-info" style="display:block;">
        <p>此处重判将忽略比赛中的提交. 如需重判比赛中的提交，请在具体比赛的控制台中进行操作.</p>
        <p>Solutions in contests will be <strong>ignored</strong>. If you want to rejudge problems in a contest, use contest rejudge.</p>
    </span>
    {/if}
    <form id="problem_rejudge_form" method='post' action="{$submit_url}">
        <div style="display: flex; align-items: flex-start;">
            <div style="display: inline-block;">
                <div class="d-grid gap-2 mx-auto">
                    <button type="button" class="btn btn-xs btn-danger"  style="width:80px;"  title="全选" id="check_res_all">全选(All)</button>
                    <button type="button" class="btn btn-xs btn-success" style="width:80px;"  title="清空" id="check_res_non">清空(Non)</button>
                    <button type="button" class="btn btn-xs btn-warning" style="width:80px;"  title="反选" id="check_res_rev">反选(Rev)</button>
                    <button type="button" class="btn btn-xs btn-primary" style="width:80px;"  title="默认" id="check_res_dft">默认(Dft)</button>
                </div>
            </div>
            <div style="display: inline-block; margin-left: 10px;">
                <div class="d-grid gap-2 mx-auto">
                    <div class="form-check">
                        <input name="rejudge_res_check[]" class="form-check-input rejudge_res_check" type="checkbox" id="rejudge_res_check_ac" value="4"  title="通过"  >     
                        <label for="rejudge_res_check_ac" class="form-check-label text-success">通过(AC)</label>
                    </div>
                    <div class="form-check">
                        <input name="rejudge_res_check[]" class="form-check-input rejudge_res_check" type="checkbox" id="rejudge_res_check_pe" value="5"  title="格式错误"checked>  
                        <label for="rejudge_res_check_pe" class="form-check-label text-danger"> 格式错误(PE)</label>
                    </div>
                    <div class="form-check">
                        <input name="rejudge_res_check[]" class="form-check-input rejudge_res_check" type="checkbox" id="rejudge_res_check_wa" value="6"  title="错误"    checked>  
                        <label for="rejudge_res_check_wa" class="form-check-label text-danger"> 答案错误(WA)</label>
                    </div>
                    <div class="form-check">
                        <input name="rejudge_res_check[]" class="form-check-input rejudge_res_check" type="checkbox" id="rejudge_res_check_tl" value="7"  title="超时"    checked>  
                        <label for="rejudge_res_check_tl" class="form-check-label text-warning">超时(TLE)</label>
                    </div>
                    <div class="form-check">
                        <input name="rejudge_res_check[]" class="form-check-input rejudge_res_check" type="checkbox" id="rejudge_res_check_ml" value="8"  title="超内存"  checked>  
                        <label for="rejudge_res_check_ml" class="form-check-label text-warning">超内存(MLE)</label>
                    </div>
                    <div class="form-check">
                        <input name="rejudge_res_check[]" class="form-check-input rejudge_res_check" type="checkbox" id="rejudge_res_check_ol" value="9"  title="输出超限"checked>  
                        <label for="rejudge_res_check_ol" class="form-check-label text-warning">输出超限(OLE)</label>
                    </div>
                    <div class="form-check">
                        <input name="rejudge_res_check[]" class="form-check-input rejudge_res_check" type="checkbox" id="rejudge_res_check_re" value="10" title="运行错误"checked>  
                        <label for="rejudge_res_check_re" class="form-check-label text-warning">运行错误(RE)</label>
                    </div>
                    <div class="form-check">
                        <input name="rejudge_res_check[]" class="form-check-input rejudge_res_check" type="checkbox" id="rejudge_res_check_ce" value="11" title="编译错误"checked>  
                        <label for="rejudge_res_check_ce" class="form-check-label text-info">   编译错误(CE)</label>
                    </div>
                    <div class="form-check">
                        <input name="rejudge_res_check[]" class="form-check-input rejudge_res_check" type="checkbox" id="rejudge_res_check_ci" value="2"  title="编译中"  >         
                        <label for="rejudge_res_check_ci" class="form-check-label text-default">编译中(CI)</label>
                    </div>
                    <div class="form-check">
                        <input name="rejudge_res_check[]" class="form-check-input rejudge_res_check" type="checkbox" id="rejudge_res_check_rj" value="3"  title="评测中"  >         
                        <label for="rejudge_res_check_rj" class="form-check-label text-default">评测中(RJ)</label>
                    </div>
                </div>
            </div>
            <div style="display: inline-block; margin-left: 20px; padding-top:0;">
                <div class="form-group">
                    <label for="solution_id">基于提交号(By Solution ID)：</label>
                    <input type="text" class="form-control" id="solution_id" placeholder="Solution ID..." name="solution_id" style="max-width:400px;">
                    <br/>
                    <label for="problem_id">基于题号(By Problem ID)：</label>
                    <input type="text" class="form-control" id="problem_id" placeholder="{if $controller=='problem'}数字(Numerate ID) 2000,2001...{else/}字母(Alphabet ID) A,B,C...{/if}" name="problem_id" style="max-width:400px;">
                    <br/>
                </div>

                <button type="submit" id="submit_button" class="btn btn-primary">Rejudge</button>
                <button type="reset" id="submit_button" class="btn btn-warning">Reset Form</button>
            </div>
        </div>
    </form>
</div>
<script type="text/javascript">
let DEFAULT_REJUDGE_RES = new Set(["5", "6", "7", "8", "9", "10", "11"]);
    $(document).ready(function() {
        $('#check_res_all').click(function() {
            $('.rejudge_res_check').each(function() {
                this.checked = true;
            });
        });
        $('#check_res_non').click(function() {
            $('.rejudge_res_check').each(function() {
                this.checked = false;
            });
        });
        $('#check_res_rev').click(function() {
            $('.rejudge_res_check').each(function() {
                this.checked = !this.checked;
            });
        });
        $('#check_res_dft').click(function() {
            $('.rejudge_res_check').each(function() {
                this.checked = DEFAULT_REJUDGE_RES.has(this.value);
            });
        });
    });
    function SubmitRejudge(form) {
        $(form).ajaxSubmit({
            success: function(ret)
            {
                var submit_button = $('#submit_button');
                if(ret["code"] == 1)
                {
                    alerty.success(ret['msg']);
                    button_delay(submit_button, 3, 'Rejudge');
                    if($('#open_status_window_check').bootstrapSwitch('state') == true)
                        setTimeout(function(){window.open(ret['data']);}, 300);
                }
                else
                {
                    alerty.alert(ret['msg']);
                    button_delay(submit_button, 3, 'Rejudge');
                }
                return false;
            }
        });
    }
</script>
<style>
.btn-xs, .form-check-label, .form-check-input {
    --bs-btn-padding-y: .25rem; 
    --bs-btn-padding-x: .5rem; 
    --bs-btn-font-size: .75rem;
}
</style>