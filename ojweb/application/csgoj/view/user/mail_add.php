{include file="../../csgoj/view/user/mail_header" /}
<form role="form" id="topic_add_form" action="mail_add_ajax" method="POST">
    <div class="mb-3">
        <label for="user_id" class="form-label">*To User:</label>
        <input type="text" name="user_id" class="form-control" style="width:200px;" >
    </div>
    <div class="mb-3">
        <label for="title" class="form-label">*Mail Title：</label>
        <input type="text" name="title" placeholder="1~64 characters" class="form-control" style="max-width:900px;" >
    </div>
    <div class="mb-3">
        <label for="content" class="form-label">Mail Content：</label>
        <textarea class="form-control" rows="20" name="content" spellcheck="false" placeholder="^_^" style="max-width:900px;" ></textarea>
    </div>
    <div class="mb-3">
        <label class="form-label">*V-Code ：</label>
        <input type="text" class="form-control" placeholder="Verification Code" name="vcode" required>
        <label for="vcode" class="notification_label"></label>
    </div>
    <button type="submit" id='submit_button' class="btn btn-primary">Send Mail</button>
    <label id="vcode">{:captcha_img()}</label>
</form>

<script type="text/javascript">
    var submit_button = $('#submit_button');
    $('#vcode').on('click', function(){
        var ts = Date.parse(new Date())/1000;
        this.getElementsByTagName('img')[0].src = "/captcha?id="+ts;
    });
    $(document).ready(function(){
        // 使用 form_validate_tip.js 进行表单验证
        window.FormValidationTip.initFormValidation('#topic_add_form', {
            user_id: {
                rules: {
                    required: true,
                    minlength: 5,
                    maxlength: 20
                }
            },
            title: {
                rules: {
                    required: true,
                    minlength: 1,
                    maxlength: 64
                }
            },
            content: {
                rules: {
                    minlength: 2,
                    maxlength: 16384
                }
            }
        }, function(form) {
            submit_button.attr('disabled', true);
            $(form).ajaxSubmit(function(ret) {
                if(ret["code"] == 1) {
                    alerty.success(ret['msg']);
                    setTimeout(function(){location.href='mail_detail?mail_id=' + ret['data']['mail_id'];}, 500);
                    return true;
                }
                else {
                    alerty.alert(ret["msg"]);
                    button_delay(submit_button, 3, submit_button.text());
                }
                return false;
            });
            return false;
        });
    });
    $("textarea").on('keydown',function(e){
        if(e.keyCode == 9){
            e.preventDefault();
            var indent = '    ';
            var start = this.selectionStart;
            var end = this.selectionEnd;
            var selected = window.getSelection().toString();
            selected = indent + selected.replace(/\n/g,'\n'+indent);
            this.value = this.value.substring(0,start) + selected + this.value.substring(end);
            this.setSelectionRange(start+indent.length,start+selected.length);
        }
    })
</script>