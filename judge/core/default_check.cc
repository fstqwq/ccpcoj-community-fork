#include "testlib.h"

int main(int argc, char* argv[]) {
    // 使用 testlib 的 checker 模式：
    //   default_check <Input_File> <Output_File> <Answer_File>
    //
    // 默认评测采用“宽松空白”口径：按 token 对比，忽略多余空格/换行/行末空格，
    // 但不允许多余 token（有多余 token 仍应判错）。
    registerTestlibCmd(argc, argv);

    // 按 token 对比（testlib 的 token 会跳过空白）
    while (!ans.seekEof()) {
        if (ouf.seekEof()) {
            quitf(_wa, "答案错误：输出过短");
        }
        std::string a = ans.readToken();
        std::string b = ouf.readToken();
        if (a != b) {
            quitf(_wa, "答案错误");
        }
    }

    // 标准答案结束后，选手输出只能有空白，不能有额外 token
    if (!ouf.seekEof()) {
        quitf(_wa, "答案错误：输出过长");
    }

    quitf(_ok, "答案正确");
}
