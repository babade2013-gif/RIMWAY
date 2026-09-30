import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/localization/app_localizations.dart';
import '../../../core/theme/app_theme.dart';
import '../application/captain_provider.dart';

class CaptainWalletScreen extends StatefulWidget {
  const CaptainWalletScreen({super.key});

  @override
  State<CaptainWalletScreen> createState() => _CaptainWalletScreenState();
}

class _CaptainWalletScreenState extends State<CaptainWalletScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<CaptainProvider>().fetchWallet();
    });
  }

  Future<void> _openWhatsAppTopUp(CaptainProvider captain) async {
    final name = captain.captainName ?? 'كابتن ريم واي';
    final phone = captain.captainPhone ?? '';
    final message = Uri.encodeComponent(
      'مرحباً خدمة شحن RIM WAY، أرغب في شحن رصيدي التشغيلي.\nاسم الكابتن: $name\nالهاتف: $phone',
    );
    final whatsappUrl = Uri.parse('https://wa.me/22240000000?text=$message');
    try {
      if (await canLaunchUrl(whatsappUrl)) {
        await launchUrl(whatsappUrl, mode: LaunchMode.externalApplication);
      } else {
        await launchUrl(whatsappUrl);
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('تعذر فتح واتساب، يرجى التواصل عبر الرقم: +222 40000000')),
        );
      }
    }
  }

  void _showTopUpDialog(BuildContext context, CaptainProvider captain) {
    final amountController = TextEditingController();
    final refController = TextEditingController();
    final formKey = GlobalKey<FormState>();

    showDialog(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        title: Text(
          context.tr('top_up_dialog_title'),
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        content: SingleChildScrollView(
          child: Form(
            key: formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  context.tr('top_up_dialog_desc'),
                  style: const TextStyle(fontSize: 13, color: Colors.black87),
                ),
                const SizedBox(height: 16),
                // WhatsApp Button
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: () {
                      Navigator.pop(dialogCtx);
                      _openWhatsAppTopUp(captain);
                    },
                    icon: const Icon(Icons.chat, color: Colors.white),
                    label: Text(context.tr('open_whatsapp')),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF25D366),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                  ),
                ),
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 12),
                  child: Row(
                    children: [
                      Expanded(child: Divider()),
                      Padding(
                        padding: EdgeInsets.symmetric(horizontal: 8),
                        child: Text('أو تسجيل إشعار تحويل', style: TextStyle(fontSize: 12, color: Colors.grey)),
                      ),
                      Expanded(child: Divider()),
                    ],
                  ),
                ),
                TextFormField(
                  controller: amountController,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    labelText: context.tr('transfer_amount'),
                    hintText: '500',
                    border: const OutlineInputBorder(),
                    prefixIcon: const Icon(Icons.payments),
                  ),
                  validator: (val) {
                    if (val == null || val.trim().isEmpty) return 'يرجى إدخال المبلغ';
                    final num = double.tryParse(val.trim());
                    if (num == null || num <= 0) return 'المبلغ يجب أن يكون أكبر من 0';
                    return null;
                  },
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: refController,
                  decoration: InputDecoration(
                    labelText: context.tr('transfer_reference'),
                    hintText: 'رقم العملية من بنكيلي أو السداد',
                    border: const OutlineInputBorder(),
                    prefixIcon: const Icon(Icons.receipt_long),
                  ),
                ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogCtx),
            child: Text(context.tr('cancel')),
          ),
          ElevatedButton(
            onPressed: () async {
              if (formKey.currentState?.validate() ?? false) {
                final amt = double.parse(amountController.text.trim());
                final ref = refController.text.trim();
                Navigator.pop(dialogCtx);
                final success = await captain.submitTopUpRequest(amt, reference: ref);
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(
                        success
                            ? context.tr('top_up_submitted_success')
                            : (captain.errorMessage ?? 'فشل إرسال الطلب'),
                      ),
                      backgroundColor: success ? Colors.green : Colors.red,
                    ),
                  );
                }
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primaryColor),
            child: Text(context.tr('submit_request')),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final captain = context.watch<CaptainProvider>();
    final isExhausted = captain.isWalletExhausted;

    return Scaffold(
      appBar: AppBar(
        title: Text(context.tr('wallet')),
        backgroundColor: AppTheme.primaryColor,
        foregroundColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => captain.fetchWallet(),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => captain.fetchWallet(),
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Warning Banner if balance <= 0
            if (isExhausted)
              Container(
                margin: const EdgeInsets.only(bottom: 16),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.red.shade300, width: 1.5),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.warning_amber_rounded, color: Colors.red.shade700, size: 28),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            context.tr('wallet_exhausted_warning'),
                            style: TextStyle(
                              color: Colors.red.shade900,
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                              height: 1.3,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

            // Balance Card
            Card(
              elevation: 3,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  children: [
                    Text(
                      context.tr('operating_balance'),
                      style: TextStyle(fontSize: 14, color: Colors.grey.shade600, fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Text(
                          captain.walletBalance.toStringAsFixed(0),
                          style: TextStyle(
                            fontSize: 40,
                            fontWeight: FontWeight.bold,
                            color: isExhausted ? Colors.red.shade700 : AppTheme.primaryColor,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          context.tr('mru'),
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.grey.shade700),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    // Status Badge
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: isExhausted ? Colors.red.shade50 : Colors.green.shade50,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: isExhausted ? Colors.red.shade200 : Colors.green.shade200,
                        ),
                      ),
                      child: Text(
                        isExhausted ? 'رصيد غير كافٍ لاستقبال الرحلات' : context.tr('wallet_active_status'),
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: isExhausted ? Colors.red.shade800 : Colors.green.shade800,
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                    // Action button
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: () => _showTopUpDialog(context, captain),
                        icon: const Icon(Icons.add_card, color: Colors.white),
                        label: Text(
                          context.tr('top_up_wallet'),
                          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.primaryColor,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 16),

            // How it works note
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.blue.shade50,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.blue.shade200),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.info_outline, color: Colors.blue.shade700, size: 22),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      context.tr('wallet_how_it_works'),
                      style: TextStyle(
                        color: Colors.blue.shade900,
                        fontSize: 12,
                        height: 1.4,
                      ),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // Ledger Title
            Text(
              context.tr('recent_transactions'),
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),

            // Transactions list
            if (captain.walletLoading)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: CircularProgressIndicator(),
                ),
              )
            else if (captain.walletTransactions.isEmpty)
              Center(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 32),
                  child: Column(
                    children: [
                      Icon(Icons.receipt_long, size: 48, color: Colors.grey.shade400),
                      const SizedBox(height: 8),
                      Text(
                        context.tr('no_transactions'),
                        style: TextStyle(color: Colors.grey.shade500, fontSize: 14),
                      ),
                    ],
                  ),
                ),
              )
            else
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: captain.walletTransactions.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (ctx, idx) {
                  final tx = captain.walletTransactions[idx] as Map<String, dynamic>;
                  final type = tx['type'] as String? ?? '';
                  final amount = tx['amount'] is num
                      ? (tx['amount'] as num).toDouble()
                      : (double.tryParse(tx['amount']?.toString() ?? '0') ?? 0.0);
                  final isCredit = type == 'TOP_UP' || type == 'MANUAL_CREDIT';
                  final createdAt = tx['createdAt'] as String?;
                  final dateStr = createdAt != null
                      ? DateTime.tryParse(createdAt)?.toLocal().toString().substring(0, 16) ?? ''
                      : '';
                  final desc = tx['description'] as String? ?? '';

                  String typeLabel = type;
                  if (type == 'COMMISSION') typeLabel = context.tr('commission_debit');
                  if (type == 'TOP_UP') typeLabel = context.tr('top_up_credit');
                  if (type == 'MANUAL_CREDIT') typeLabel = context.tr('manual_credit');
                  if (type == 'MANUAL_DEBIT') typeLabel = context.tr('manual_debit');

                  return ListTile(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                    leading: CircleAvatar(
                      backgroundColor: isCredit ? Colors.green.shade50 : Colors.red.shade50,
                      child: Icon(
                        isCredit ? Icons.arrow_downward : Icons.arrow_upward,
                        color: isCredit ? Colors.green.shade700 : Colors.red.shade700,
                        size: 20,
                      ),
                    ),
                    title: Text(
                      typeLabel,
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                    ),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (desc.isNotEmpty)
                          Text(desc, style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
                        Text(dateStr, style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
                      ],
                    ),
                    trailing: Text(
                      '${isCredit ? '+' : '-'}${amount.toStringAsFixed(0)} MRU',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                        color: isCredit ? Colors.green.shade700 : Colors.red.shade700,
                      ),
                    ),
                  );
                },
              ),
          ],
        ),
      ),
    );
  }
}
