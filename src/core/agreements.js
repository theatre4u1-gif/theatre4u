// Shared agreement helpers so the platform-protection notice and default terms are
// defined in ONE place and stay identical across Rentals and Borrowed & Lent.

export const DEFAULT_RENTAL_TERMS =
  "1. The renter is responsible for every item listed above from the time it leaves until it is returned.\n" +
  "2. Items are due back by the date shown. Late returns may be charged a late fee.\n" +
  "3. The renter agrees to return all items in the same condition, and to pay for cleaning, repair, or replacement of any item returned damaged, altered, or not at all.\n" +
  "4. A security deposit may be required and is returned once all items come back in good condition.\n" +
  "5. Items may not be resold, sublet, or loaned to anyone else without written permission.\n" +
  "6. By signing below, the renter agrees to these terms.";

export const DEFAULT_LOAN_TERMS =
  "1. The item(s) above remain the property of the lender and are shared as a courtesy.\n" +
  "2. Items are due back by the date shown. Please return them on time so others can use them.\n" +
  "3. The borrower agrees to return items in the same condition, and to pay for cleaning, repair, or replacement of any item that is lost or returned damaged.\n" +
  "4. Items may not be resold, sublet, or loaned to anyone else without the lender's permission.\n" +
  "5. By signing below, the borrower agrees to these terms.";

// Fixed liability notice that protects the platform. `bizName` must already be HTML-escaped
// when used in a print document. `brand` is the door-appropriate app name (Theatre4u / ArtsTracker).
export function platformNotice(bizName, brand) {
  return `This agreement is solely between ${bizName} and the other party named above. ${brand} (a product of Artstracker LLC) provides inventory software only. It is not a party to this agreement, makes no warranties about any item, and is not responsible for the condition, use, return, loss, or damage of any item or for any dispute between the parties. All responsibility for this agreement rests with the parties named above.`;
}
