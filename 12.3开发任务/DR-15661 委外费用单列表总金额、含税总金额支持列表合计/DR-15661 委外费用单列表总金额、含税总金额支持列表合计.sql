GO
--DR-15661 委外费用单列表总金额、含税总金额支持列表合计
declare @solutionId int
select @solutionId=id from eap_ColumnSetSolution where Name = 'OM_OutSourceExpenseVoucher_VoucherList'
update Eap_ColumnSet set NeedSum=1,IsMergeColumn=0,IsShowTotal=1,IsTotal=1 where SolutionID = @solutionId and Field in ('OutSourceExpenseVoucher.OrigSumAmount','OutSourceExpenseVoucher.OrigTotalTaxAmount')
update Eap_ColumnSet_User set IsMergeColumn=0,DisplayOld=1,IsTotal=1 where SolutionID = @solutionId and Field in ('OutSourceExpenseVoucher.OrigSumAmount','OutSourceExpenseVoucher.OrigTotalTaxAmount')

GO