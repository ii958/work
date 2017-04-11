GO
--放开委外费用单表头的整单折扣%

update EAP_VoucherControls set SysPropValue='AllowRecordValue=False;AddReadOnly=False;EditReadOnly=True;', EditReadOnly=0, AddReadOnly=0
where VoucherID=(select id from EAP_Voucher where Name='OutSourceExpenseVoucher') and Name='DiscountRate'

GO