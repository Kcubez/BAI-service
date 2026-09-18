/**
 * Telegram message templates, format prompts, and menu builders.
 * Pure string builders extracted verbatim from the webhook route —
 * no database, network, or request access. User-facing copy stays
 * bilingual (English + Burmese) by design.
 */

export function truncateTelegramLabel(value: string, maxLength = 24) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

export function getPlainTemplateTextForMode(mode: string | null | undefined): string {
  switch (mode) {
    case 'customer_service':
      return [
        "Date:",
        "Customer Name:",
        "Company:",
        "Phone:",
        "Email:",
        "Purchased Service:",
        "Purchase Amount MMK:",
        "Status:",
        "Next Follow Up:",
        "CSAT:",
        "Last Contact Note:",
      ].join("\n");
    case 'project_expiry':
      return [
        "Date:",
        "Check List:",
        "URL:",
        "Package:",
        "Domain Provider:",
        "Hosting Provider:",
        "Hosting Remark:",
        "Domain Expiration Date:",
        "Hosting Expiration Date:",
        "Remark:",
      ].join("\n");
    case 'website_update':
      return [
        "Date:",
        "Project Name:",
        "Website Link:",
        "Business Type:",
        "Package Name:",
        "Status:",
        "Remark:",
      ].join("\n");
    case 'project_service_tracking':
      return [
        "Record Date:",
        "Project Name:",
        "Website Link:",
        "Business Type:",
        "Package Name:",
        "Domain Provider:",
        "Hosting Provider:",
        "Hosting Remark:",
        "Domain Expiration Date:",
        "Hosting Expiration Date:",
        "Offer Expiry / Renewal Date:",
        "Project Status:",
        "Expiry / Service Remark:",
        "Update Status:",
        "Update Remark:",
      ].join("\n");
    case 'finance_transactions':
      return [
        "Date:",
        "Description:",
        "Category:",
        "Type:",
        "Amount (MMK):",
        "Payment Method:",
        "Reference:",
        "Notes:",
      ].join("\n");
    case 'business_report':
      return [
        "Date:",
        "Reporter:",
        "Marketing Budget:",
        "Marketing Channel:",
        "Calls Made:",
        "Appointments Made:",
        "Appointments Kept:",
        "New Leads:",
        "Total Sales Amount:",
        "Closed Deals:",
        "Pending Deals:",
        "Notes:",
      ].join("\n");
    case 'demand_report':
    default:
      return [
        "Date:",
        "Customer Name:",
        "Phone:",
        "Company:",
        "Service Name:",
        "Service Amount:",
        "Service Qty:",
        "Follow-up Date:",
        "Note:",
      ].join("\n");
  }
}

export function buildFormatInlineButtons(mode: string | null | undefined) {
  return {
    inline_keyboard: [
      [
        { text: "📋 Template ကြည့်ရန်", callback_data: "action:template" },
        { text: "↩️ Main Menu", callback_data: "action:menu" },
      ],
    ],
  };
}

export function buildMainMenuButtons(allowedDepartments: string[]) {
  const buttons: { text: string; callback_data: string }[][] = [];
  const row1: { text: string; callback_data: string }[] = [];
  const row2: { text: string; callback_data: string }[] = [];
  const row3: { text: string; callback_data: string }[] = [];
  const row4: { text: string; callback_data: string }[] = [];

  if (allowedDepartments.includes('QA')) {
    row1.push({ text: "🤖 Q&A မေးမြန်း", callback_data: "mode:qa" });
  }
  if (allowedDepartments.includes('Sales')) {
    row1.push({ text: "📈 Sales & Marketing", callback_data: "mode:demand_report" });
    row2.push({ text: "🎧 Customer Service", callback_data: "mode:customer_service" });
  }
  if (allowedDepartments.includes('IT')) {
    row3.push({ text: "🧩 Project & Service Tracking", callback_data: "mode:project_service_tracking" });
  }
  if (allowedDepartments.includes('Finance')) {
    row2.push({ text: "💳 Finance Transactions", callback_data: "mode:finance_transactions" });
    row4.push({ text: "📊 Business KPI Report", callback_data: "mode:business_report" });
  }

  if (row1.length) buttons.push(row1);
  if (row2.length) buttons.push(row2);
  if (row3.length) buttons.push(row3);
  if (row4.length) buttons.push(row4);

  return { inline_keyboard: buttons };
}

export function getDepartmentForMode(mode: string): string | null {
  if (mode === 'demand_report' || mode === 'customer_service') return 'Sales';
  if (mode === 'project_expiry' || mode === 'website_update' || mode === 'project_service_tracking') return 'IT';
  if (mode === 'business_report' || mode === 'finance_transactions') return 'Finance';
  if (mode === 'qa') return 'QA';
  return null;
}

export function normalizeTelegramReportMode(mode: string): string {
  // Project expiry and website update are views within the combined tracking
  // workflow, not separate Telegram data-entry modes.
  return mode === 'project_expiry' || mode === 'website_update'
    ? 'project_service_tracking'
    : mode;
}

export function getDepartmentNameBurmese(dep: string): string {
  if (dep === 'Sales') return 'Sales & Marketing (အရောင်းနှင့်စျေးကွက်)';
  if (dep === 'IT') return 'IT & Projects (စီမံကိန်းနှင့် အိုင်တီ)';
  if (dep === 'Finance') return 'Finance & Operations (ဘဏ္ဍာရေးနှင့် လုပ်ငန်းဆောင်ရွက်မှု)';
  if (dep === 'QA') return 'QA / Support (အမေးအဖြေ)';
  return dep;
}

export function getFormatPrompt(): string {
  return [
    "📈 ━━━━━━━━━━━━━━━━━━━━",
    "",
    "  <b>Sales & Marketing Mode</b>",
    "",
    "━━━━━━━━━━━━━━━━━━━━",
    "",
    "📄 စာသား <b>သို့မဟုတ်</b> Excel/CSV",
    "    ဖိုင်ကို တိုက်ရိုက်ပို့နိုင်ပါသည်",
    "",
    "📝 <b>စာသားတစ်စောင် = record တစ်ခု</b>။ အောက်ကစာကို Copy ကူးပြီး colon နောက်မှာ value ဖြည့်ပါ။",
    "<pre>",
    "Date: 2026-06-01",
    "Customer Name: Aung Kyaw Moe",
    "Phone: 0995011222",
    "Company: Mandalay Plaza",
    "Service Name: Website Gold Package",
    "Service Amount: 1500000",
    "Service Qty: 1",
    "Follow-up Date: 2026-06-05",
    "Note: Requires custom design",
    "</pre>",
    "",
    "💡 <i>မလိုအပ်သော စာကြောင်းများ ချန်လှပ်ထားနိုင်ပါသည်</i>",
    "",
    "━━━━━━━━━━━━━━━━━━━━",
  ].join("\n");
}

export function getCustomerServiceFormatPrompt(): string {
  return [
    "🎧 ━━━━━━━━━━━━━━━━━━━━",
    "",
    "  <b>Customer Service Mode</b>",
    "  <i>ဝယ်ယူပြီး customer service / follow-up မှတ်တမ်း</i>",
    "",
    "━━━━━━━━━━━━━━━━━━━━",
    "",
    "📄 စာသား <b>သို့မဟုတ်</b> Excel/CSV",
    "    ဖိုင်ကို တိုက်ရိုက်ပို့နိုင်ပါသည်",
    "",
    "📝 <b>စာသားတစ်စောင် = record တစ်ခု</b>။ <code>Date</code>, <code>Customer Name</code>, <code>Purchased Service</code> နှင့် <code>Purchase Amount MMK</code> ကို မဖြစ်မနေဖြည့်ပါ။",
    "<pre>",
    "Date: 2026-06-02",
    "Customer Name: Aung Kyaw Moe",
    "Company: Mandalay Plaza",
    "Phone: 0995011222",
    "Email: aung@example.com",
    "Purchased Service: Website Gold Package",
    "Purchase Amount MMK: 1500000",
    "Status: closed",
    "Next Follow Up: 2026-06-25",
    "CSAT: 5",
    "Last Contact Note: Project kicked off",
    "</pre>",
    "",
    "━━━━━━━━━━━━━━━━━━━━",
  ].join("\n");
}

export function getProjectExpiryFormatPrompt(): string {
  return [
    "⏰ ━━━━━━━━━━━━━━━━━━━━",
    "",
    "  <b>Project Expiry Mode</b>",
    "  <i>စီမံကိန်း သက်တမ်းကုန်ဆုံးမှု</i>",
    "",
    "━━━━━━━━━━━━━━━━━━━━",
    "",
    "📄 စာသား <b>သို့မဟုတ်</b> Excel ဖိုင်",
    "    ပေးပို့နိုင်ပါသည်",
    "",
    "📝 <b>စာသားပုံစံ:</b>",
    "<pre>",
    "• Date: [YYYY-MM-DD]",
    "• Check List: [Project/Checklist အမည်]",
    "• URL: [Website URL]",
    "• Package: [Package]",
    "• Domain Provider: [Provider]",
    "• Hosting Provider: [Provider]",
    "• Hosting Remark: [မှတ်ချက်]",
    "• Domain Expiration Date: [YYYY-MM-DD]",
    "• Hosting Expiration Date: [YYYY-MM-DD]",
    "• Remark: [မှတ်ချက်]",
    "</pre>",
    "",
    "━━━━━━━━━━━━━━━━━━━━",
  ].join("\n");
}

export function getWebsiteUpdateFormatPrompt(): string {
  return [
    "🔧 ━━━━━━━━━━━━━━━━━━━━",
    "",
    "  <b>Website Update Mode</b>",
    "  <i>ဝဘ်ဆိုဒ် အပ်ဒိတ်/ထိန်းသိမ်းမှု</i>",
    "",
    "━━━━━━━━━━━━━━━━━━━━",
    "",
    "📄 စာသား <b>သို့မဟုတ်</b> Excel ဖိုင်",
    "    ပေးပို့နိုင်ပါသည်",
    "",
    "📝 <b>စာသားပုံစံ:</b>",
    "<pre>",
    "• Date: [YYYY-MM-DD]",
    "• Project Name: [Project/Website အမည်]",
    "• Website Link: [Website URL]",
    "• Business Type: [လုပ်ငန်းအမျိုးအစား]",
    "• Package Name: [Package]",
    "• Status: [up_to_date / pending / in_progress]",
    "• Remark: [မှတ်ချက်]",
    "</pre>",
    "",
    "━━━━━━━━━━━━━━━━━━━━",
  ].join("\n");
}

export function getProjectServiceTrackingFormatPrompt(): string {
  return [
    "🧩 ━━━━━━━━━━━━━━━━━━━━",
    "",
    "  <b>Project &amp; Service Tracking Mode</b>",
    "  <i>Project expiry, offer renewal, website update နှင့် maintenance</i>",
    "",
    "━━━━━━━━━━━━━━━━━━━━",
    "",
    "📄 စာသား <b>သို့မဟုတ်</b> Excel ဖိုင်",
    "    တစ်ခုတည်းဖြင့် Project နှင့် Website records ကို တင်သွင်းနိုင်ပါသည်",
    "",
    "📝 <b>စာသားတစ်စောင် = Project + Website record တစ်ခု</b>။ မသက်ဆိုင်သော field များကို ချန်ထားနိုင်ပါသည်။",
    "<pre>",
    "Record Date: 2026-06-01",
    "Project Name: Mandalay Plaza Site",
    "Website Link: mandalayplaza.com",
    "Business Type: Retail & Mall",
    "Package Name: Website Gold Package",
    "Domain Provider: Namecheap",
    "Hosting Provider: DigitalOcean",
    "Hosting Remark: 2GB Droplet",
    "Domain Expiration Date: 2026-06-28",
    "Hosting Expiration Date: 2026-07-05",
    "Offer Expiry / Renewal Date: 2026-07-01",
    "Project Status: active",
    "Expiry / Service Remark: Renew early",
    "Update Status: in_progress",
    "Update Remark: Adding promo banner",
    "</pre>",
    "",
    "💡 <i>မလိုအပ်သော စာကြောင်းများ ချန်လှပ်ထားနိုင်ပါသည်</i>",
    "",
    "━━━━━━━━━━━━━━━━━━━━",
  ].join("\n");
}

export function getFinanceTransactionsFormatPrompt(): string {
  return [
    "💳 ━━━━━━━━━━━━━━━━━━━━",
    "",
    "  <b>Finance Transactions Mode</b>",
    "  <i>ငွေဝင်/ငွေထွက် မှတ်တမ်း</i>",
    "",
    "━━━━━━━━━━━━━━━━━━━━",
    "",
    "📄 စာသား <b>သို့မဟုတ်</b> Excel/CSV",
    "    ဖိုင်ကို တိုက်ရိုက်ပို့နိုင်ပါသည်",
    "",
    "📝 <b>Required:</b> Date, Description, Type, Amount (MMK)။ Type ကို <code>Income</code> သို့မဟုတ် <code>Expense</code> ဟုသာရေးပါ။",
    "<pre>",
    "Date: 2026-06-01",
    "Description: Mandalay Plaza Downpayment",
    "Category: Service Revenue",
    "Type: Income",
    "Amount (MMK): 1500000",
    "Payment Method: Bank Transfer",
    "Reference: REC-0601",
    "Notes: Gold Package",
    "Finance Record Type: payment",
    "Status: paid",
    "Counterparty: Aung Kyaw Moe",
    "Due Date:",
    "Voucher Number: VCH-0601",
    "Accounting Section: Payments",
    "</pre>",
    "",
    "━━━━━━━━━━━━━━━━━━━━",
  ].join("\n");
}

export function getBusinessReportFormatPrompt(): string {
  return [
    "📊 ━━━━━━━━━━━━━━━━━━━━",
    "",
    "  <b>Business KPI Report Mode</b>",
    "  <i>လုပ်ငန်းလှုပ်ရှားမှု အစီရင်ခံစာ</i>",
    "",
    "━━━━━━━━━━━━━━━━━━━━",
    "",
    "📄 စာသား <b>သို့မဟုတ်</b> Excel ဖိုင်",
    "    ပေးပို့နိုင်ပါသည်",
    "",
    "📝 <b>စာသားတစ်စောင် = KPI report တစ်ခု</b>။ Amount များကို comma မပါဘဲ ဂဏန်းဖြင့်ရေးလျှင် ပိုရှင်းပါသည်။",
    "<pre>",
    "Date: 2026-06-05",
    "Reporter: Aung Zaw",
    "Marketing Budget: 150000",
    "Marketing Channel: Facebook",
    "Calls Made: 45",
    "Appointments Made: 12",
    "Appointments Kept: 9",
    "New Leads: 25",
    "Total Sales Amount: 2000000",
    "Closed Deals: 2",
    "Pending Deals: 4",
    "Notes: Good Messenger campaign response",
    "</pre>",
    "",
    "━━━━━━━━━━━━━━━━━━━━",
  ].join("\n");
}

// Return the full format guide for whatever report mode the sender is in.
export function getFormatPromptForMode(mode: string | null | undefined): string {
  switch (mode) {
    case 'customer_service':
      return getCustomerServiceFormatPrompt();
    case 'project_expiry':
      return getProjectExpiryFormatPrompt();
    case 'website_update':
      return getWebsiteUpdateFormatPrompt();
    case 'project_service_tracking':
      return getProjectServiceTrackingFormatPrompt();
    case 'finance_transactions':
      return getFinanceTransactionsFormatPrompt();
    case 'business_report':
      return getBusinessReportFormatPrompt();
    case 'demand_report':
      return getFormatPrompt();
    default:
      return [
        "🤖 ━━━━━━━━━━━━━━━━━━━━",
        "",
        "  <b>Q&A Mode</b>",
        "  <i>AI မေးမြန်းခြင်း</i>",
        "",
        "━━━━━━━━━━━━━━━━━━━━",
        "",
        "ပုံစံ (format) မလိုအပ်ပါ",
        "သိရှိလိုသည်များကို တိုက်ရိုက်မေးပါ",
        "",
        "━━━━━━━━━━━━━━━━━━━━",
      ].join("\n");
  }
}

// A compact footer reminding the sender of the expected fields for the
// current report mode. Appended to confirmation messages so users can see
// what to include next time without re-opening the menu.
export function getFormatHintFooter(mode: string): string {
  let fields = "";
  if (mode === 'demand_report') {
    fields = "Date • Customer Name • Phone • Company • Service Name • Service Amount • Service Qty • Follow-up Date • Note";
  } else if (mode === 'customer_service') {
    fields = "Date • Customer Name • Company • Phone • Email • Purchased Service • Purchase Amount MMK • Status • Next Follow Up • CSAT • Last Contact Note";
  } else if (mode === 'project_expiry') {
    fields = "Date • Check List • URL • Package • Domain/Hosting • Remark";
  } else if (mode === 'website_update') {
    fields = "Date • Project Name • Website Link • Business Type • Package Name • Status • Remark";
  } else if (mode === 'project_service_tracking') {
    fields = "Record Date • Project • Website • Package • Domain/Hosting Expiry • Offer Renewal • Project Status • Update Status";
  } else if (mode === 'finance_transactions') {
    fields = "Date • Description • Category • Type • Amount (MMK) • Payment Method • Reference • Notes • Finance Record Type • Status • Counterparty • Due Date • Voucher Number";
  } else if (mode === 'business_report') {
    fields = "Date • Reporter • Marketing Budget • Marketing Channel • Calls • Appointments • Leads • Sales • Deals • Notes";
  }
  return [
    "",
    "━━━━━━━━━━━━━━━━━━━━",
    `💡 <i>${fields}</i>`,
  ].join("\n");
}

export function getCopyPasteTemplateForMode(mode: string | null | undefined): string {
  switch (mode) {
    case 'demand_report':
      return [
        "📈 ━━━━━━━━━━━━━━━━━━━━",
        "",
        "  <b>Sales & Marketing Template</b>",
        "",
        "━━━━━━━━━━━━━━━━━━━━",
        "",
        "စာသားကို ဖိနှိပ်၍ Copy ကူးယူပါ -",
        "",
        "<code>• Date: \n• Customer Name: \n• Phone: \n• Company: \n• Service Name: \n• Service Amount: \n• Service Qty: \n• Follow-up Date: \n• Note: </code>",
      ].join("\n");
    case 'customer_service':
      return [
        "🎧 ━━━━━━━━━━━━━━━━━━━━",
        "",
        "  <b>Customer Service Template</b>",
        "",
        "━━━━━━━━━━━━━━━━━━━━",
        "",
        "စာသားကို ဖိနှိပ်၍ Copy ကူးယူပါ -",
        "",
        "<code>• Date: \n• Customer Name: \n• Company: \n• Phone: \n• Email: \n• Purchased Service: \n• Purchase Amount MMK: \n• Status: \n• Next Follow Up: \n• CSAT: \n• Last Contact Note: </code>",
      ].join("\n");
    case 'project_expiry':
      return [
        "⏰ ━━━━━━━━━━━━━━━━━━━━",
        "",
        "  <b>Project Expiry Template</b>",
        "",
        "━━━━━━━━━━━━━━━━━━━━",
        "",
        "စာသားကို ဖိနှိပ်၍ Copy ကူးယူပါ -",
        "",
        "<code>• Date: \n• Check List: \n• URL: \n• Package: \n• Domain Provider: \n• Hosting Provider: \n• Hosting Remark: \n• Domain Expiration Date: \n• Hosting Expiration Date: \n• Remark: </code>",
      ].join("\n");
    case 'website_update':
      return [
        "🔧 ━━━━━━━━━━━━━━━━━━━━",
        "",
        "  <b>Website Update Template</b>",
        "",
        "━━━━━━━━━━━━━━━━━━━━",
        "",
        "စာသားကို ဖိနှိပ်၍ Copy ကူးယူပါ -",
        "",
        "<code>• Date: \n• Project Name: \n• Website Link: \n• Business Type: \n• Package Name: \n• Status: \n• Remark: </code>",
      ].join("\n");
    case 'project_service_tracking':
      return [
        "🧩 ━━━━━━━━━━━━━━━━━━━━",
        "",
        "  <b>Project &amp; Service Tracking Template</b>",
        "",
        "━━━━━━━━━━━━━━━━━━━━",
        "",
        "စာသားကို ဖိနှိပ်၍ Copy ကူးယူပါ -",
        "",
        "<code>• Record Date: \n• Project Name: \n• Website Link: \n• Business Type: \n• Package Name: \n• Domain Provider: \n• Hosting Provider: \n• Hosting Remark: \n• Domain Expiration Date: \n• Hosting Expiration Date: \n• Offer Expiry / Renewal Date: \n• Project Status: \n• Expiry / Service Remark: \n• Update Status: \n• Update Remark: </code>",
      ].join("\n");
    case 'finance_transactions':
      return [
        "💳 ━━━━━━━━━━━━━━━━━━━━",
        "",
        "  <b>Finance Transactions Template</b>",
        "",
        "━━━━━━━━━━━━━━━━━━━━",
        "",
        "စာသားကို ဖိနှိပ်၍ Copy ကူးယူပါ -",
        "",
        "<code>Date: \nDescription: \nCategory: \nType: Income or Expense\nAmount (MMK): \nPayment Method: \nReference: \nNotes: \nFinance Record Type: \nStatus: \nCounterparty: \nDue Date: \nVoucher Number: \nAccounting Section: </code>",
      ].join("\n");
    case 'business_report':
      return [
        "📊 ━━━━━━━━━━━━━━━━━━━━",
        "",
        "  <b>Business KPI Report Template</b>",
        "",
        "━━━━━━━━━━━━━━━━━━━━",
        "",
        "စာသားကို ဖိနှိပ်၍ Copy ကူးယူပါ -",
        "",
        "<code>• Date: \n• Reporter: \n• Marketing Budget: \n• Marketing Channel: \n• Calls Made: \n• Appointments Made: \n• Appointments Kept: \n• New Leads: \n• Total Sales Amount: \n• Closed Deals: \n• Pending Deals: \n• Notes: </code>",
      ].join("\n");
    default:
      return [
        "🤖 ━━━━━━━━━━━━━━━━━━━━",
        "",
        "  <b>အဆင်သင့်မဖြစ်သေးပါ</b>",
        "",
        "━━━━━━━━━━━━━━━━━━━━",
        "",
        "Template ရယူရန် ဦးစွာ /menu မှ",
        "ကဏ္ဍတစ်ခုကို ရွေးချယ်ပေးပါ။",
      ].join("\n");
  }
}

export function getMyanmarFieldName(field: string): string {
  switch (field) {
    case 'customerName':
      return 'Customer Name (ဝယ်ယူသူအမည်)';
    case 'phone':
      return 'Phone Number (ဖုန်းနံပါတ်)';
    case 'service':
      return 'Service (ဝန်ဆောင်မှုအမည်)';
    case 'followUpDate':
      return 'Follow-up Date (နောက်ဆက်တွဲဆက်သွယ်ရမည့်ရက်)';
    default:
      return field;
  }
}

export function escapeHtml(value: string | null | undefined): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
