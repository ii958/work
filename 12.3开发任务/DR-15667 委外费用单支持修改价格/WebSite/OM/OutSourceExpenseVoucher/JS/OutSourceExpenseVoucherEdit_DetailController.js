
/*
 *委外费用单明细处理控制器
*/
Ufida.T.OM.Client.OutSourceExpenseVoucherEdit.DetailController = Ufida.T.OM.Client.AbstractDetailController.extend({
    init: function (opt) {
        this.base(opt);
        this.grid = $T.Get("OutSourceExpenseVoucherDetails_div");
        //计算器对象
        this.calObj = new $T.Bap.TMath.NormalCalculator();
        this.Code = voucherController.Code;

        this.isNeedAudit = opt.IsNeedAudit;
        this.productGrid = this.grid;
    },

    /**
    * 设置换算率
    * @param {object} grid 当前表格 
    * @param {object} i    当前行      
    **/
    SetUnitExchangeRate: function (grid, i) {
        var quantity = grid.getCellValue(i, "Quantity");   //计划数量
        var quantity2 = grid.getCellValue(i, "Quantity2");   //计划数量2

        if (quantity2 != 0.00) {
            //换算率 = 计划数量/计划数量2
            grid.setCellValue(i, "UnitExchangeRate", this.calObj.Divide(quantity, quantity2));
        }
    },

    //各单据实现 补全HeadDTO
    SyncHeadDTO: function (headDTO) {

        headDTO = this.base(headDTO);

        var invoiceType = null;
        var invoiceTypeCt = $T.Get("InvoiceType");

        if (!this.IsNullOrEmpty(invoiceTypeCt)) {
            invoiceType = {};
            invoiceType.Id = SCMGetControlValue(invoiceTypeCt, 'IDValue');
            invoiceType.Code = SCMGetControlValue(invoiceTypeCt, 'Code');
        }
        headDTO.InvoiceType = invoiceType

        return headDTO;
    },
    
    //条形码改变事件
    OnInventoryBarCodeRefChanged: function (ref, column, ev) {
        this.InvBarCodeChanged(ref, column, ev);
    },
    //条形码改变事件
    InvBarCodeChanged: function (grid, column, ev, barCodeName) {
        if (!barCodeName) {
            barCodeName = "InventoryBarCode";
        }
        window['$T.Instance'].grid = grid;
        window['$T.Instance'].DetaileMerge = false;
        InventoryBarCodeSelected(grid, column, ev, barCodeName)
    },
    /*
     * 数量改变事件
     */
    OnQuantityValueChange: function (grid, column, ev) {
        this.SetGridQuantityValue(grid, column);
        this.base(grid, column, ev);
    },
    /*
     * 数量改变事件
     */
    OnQuantity2ValueChange: function (grid, column, ev) {
        this.SetGridQuantityValue(grid, column);
        this.base(grid, column, ev);
    },
    /*
     * 设置表格的数量
    */
    SetGridQuantityValue: function (grid, column)
    {
        var busiTypeDto = $T.Get("BusiType").prop("Value");
        var row = grid.prop("Row");
        if (!busiTypeDto) {
            return false;
        }
        var SourceVoucherBusiTypeCode = grid.getCellValue(row, "SourceVoucherBusiTypeCode");
        var quantity = grid.getCellValue(row, column.columnName);
        if (this.IsNullOrEmpty(quantity)) {
            return false;
        }
        
        // 委外退库
        if (OMEnumItemData.AA_BusiType_OM64 == busiTypeDto.Code) {
            quantity = Math.abs(quantity) * -1;
        }
        if (OMEnumItemData.AA_BusiType_OM64 == SourceVoucherBusiTypeCode) {
            quantity = Math.abs(quantity) * -1;
        }
        if (OMEnumItemData.AA_BusiType_OM63 == SourceVoucherBusiTypeCode) {
            quantity = Math.abs(quantity);
        }
        grid.setCellValue(row, column.columnName, quantity);
        
        return true;
    },
    //换算率
    OnUnitExchangeRateValueChange: function (grid, column, ev) {
        grid.endEdit();
        this.base(grid, column, ev);
        //主数量变化
        this.BaseQuantityChange(grid);
    },


    //计量单位改变事件
    OnUnitRefChanged: function (ref, column, ev) {
        this.ReviseUnit1(ref, column, ev, this.beforeUnitID, this.beforeUnit);
    },

    //计量单位2改变事件
    OnUnit2RefChanged: function (ref, column, ev) {
        this.ReviseUnit2(ref, column, ev, this.beforeUnitID, this.beforeUnit);
    },

    //删除行事件
    OnRowDeletedHandler: function (grid, ev) {
        dbg();
        // 设置委外供应商活性/非活性
        this.SetControlState(grid);
    },
    /*
     * 设置控件的活性/非活性
     * @param {grid} 当前操作的表格
     */
    SetControlState: function (grid)
    {
        var rowCount = grid.getRowCount();
        var bo = this.IsGridHasValueByColumn(grid, "Inventory");
        if (bo) {
            // 委外供应商不可编辑
            this.Voucher.setReadOnly("Partner", true);
            this.Voucher.setReadOnly("Partner_PartnerAbbName", true);
            this.Voucher.setReadOnly("Partner_Code", true);
            // 票据类型
            this.Voucher.setReadOnly("InvoiceType", true);
            // 业务类型
            this.Voucher.setReadOnly("BusiType", true);
            
        } else {
            // 委外供应商可以编辑
            this.Voucher.setReadOnly("Partner", false);
            this.Voucher.setReadOnly("Partner_PartnerAbbName", false);
            this.Voucher.setReadOnly("Partner_Code", false);
            // 票据类型
            this.Voucher.setReadOnly("InvoiceType", false);
            // 业务类型
            this.Voucher.setReadOnly("BusiType", false);
        }
    },
    //进入行事件
    OnEnterRowHandler: function (grid, ev) {
        this.base(grid, ev);
        var toolbar = window['$T.Toolbar'];
        var row = grid.prop("Row");
        var isEffective;    //单据是否生效
        var isAllFinish = true;
        /** 12.3任务 DR-15667 委外费用单支持修改价格 
        this.SetGridColEnable(grid, "OrigPrice", false, row); //报价
        this.SetGridColEnable(grid, "DiscountRate", false, row); //折扣%
        this.SetGridColEnable(grid, "OrigDiscountPrice", false, row); //单价
        this.SetGridColEnable(grid, "TaxRate", false, row); //税率%
        this.SetGridColEnable(grid, "OrigTaxPrice", false, row); //含税单价
        this.SetGridColEnable(grid, "OrigDiscountAmount", false, row); //金额
        this.SetGridColEnable(grid, "OrigTax", false, row); //税额
        this.SetGridColEnable(grid, "OrigTaxAmount", false, row); //含税金额
        this.SetGridColEnable(grid, "OrigDiscount", false, row); //折扣金额
        this.SetGridColEnable(grid, "DiscountPrice", false, row); //本币单价
        this.SetGridColEnable(grid, "DiscountAmount", false, row); //本币金额
        this.SetGridColEnable(grid, "Tax", false, row); //本币税额
        this.SetGridColEnable(grid, "TaxPrice", false, row); //本币含税单价
        this.SetGridColEnable(grid, "TaxAmount", false, row); //本币含税金额
        this.SetGridColEnable(grid, "TaxFlag", false, row); //含税标记
        this.SetGridColEnable(grid, "Discount", false, row); //本币折扣金额
        */
        
        if ($T.Get('IsNoModify').prop("Value")) {
            var isNoModifyValue = $T.Get('IsNoModify').prop("Value");

            if (isNoModifyValue.indexOf("SaleOrderCode") != -1) {
                this.Voucher.setReadOnly("SaleOrderCode", true);
            }
        }
        
        // 手动录入不可编辑
        if (grid.getCellValue("Inventory") == null
            || grid.getCellValue("Inventory") == ""
            || grid.getCellValue("SourceVoucherCode") == null
            || grid.getCellValue("SourceVoucherCode") == "") {
            return;
        }

        if (grid.getCol("IsNoModify")) {
            this.isNoModifyDetail(grid, row, "InventoryBarCode");
            this.isNoModifyDetail(grid, row, "Inventory");
            this.isNoModifyDetail(grid, row, "Inventory_Code");
            this.isNoModifyDetail(grid, row, "Warehouse");
            this.isNoModifyDetail(grid, row, "Batch");
            this.isNoModifyDetail(grid, row, "Unit");
            this.isNoModifyDetail(grid, row, "Unit2");
            this.isNoModifyDetail(grid, row, "Quantity2");
            this.isNoModifyDetail(grid, row, "UnitExchangeRate");
            this.isNoModifyDetail(grid, row, "SaleOrderCode");

            for (var i = 0; i < 10; i++) {
                var fieldName = "freeitem" + i;
                this.isNoModifyDetail(grid, row, fieldName);
            }
        }

        if (window['$T.Instance'].Voucher.prop("EditState") == 'Read' && window['$T.Instance'].VoucherState != "Edit") {
            grid.prop("ReadOnly", true);
            return;
        }
    },
    

    // -------------------------------  票据类型改变算法及相关 start
    setColAllowNull: function (tableName, cols, value) {
        var detailGrid = document.getElementById(tableName + "_div");
        if (detailGrid != null && cols != null) {
            cols = this.removeFilterFields(cols);
            var t = cols.split(',');

            //循环体内程炜修改：原因==>解决隐藏字段校验报“不允许为空”的错误。
            for (var i = 0; i < t.length; i++) {
                var col = detailGrid.getCol(t[i]);

                if (col != null) {
                    col.allowNull = value;
                    detailGrid.setColAllowNull(t[i], value);
                }
            }
        }
    },
    //过滤掉字串中不需要的的字串 For出入库
    removeFilterFields: function (cols, removes) {
        removes = "InventoryLocation,Batch,ExpiryDate";
        var t1 = cols.split(','); //原字串
        var t2 = removes.split(','); //需要剔除的字串
        var ret = "";
        var hasFilter = true;
        for (var i = 0; i < t1.length; i++) {
            for (var j = 0; j < t2.length; j++) {
                if (t1[i] != t2[j]) {
                    hasFilter = false;
                }
                else {
                    hasFilter = true;
                    break;
                }
            }
            if (!hasFilter) ret += t1[i] + ',';
        }
        return ret;
    },
    //专用发票
    ReLoadOfInvoiceType_00: function (OldInvoiceCode, tableName) {
        //都显示
        //金额、单价只读
    },
    //普通发票
    ReLoadOfInvoiceType_01: function (OldInvoiceCode, tableName) {
        //都显示
        //无税得隐藏，单价，本币单价，金额，本币金额，单价2，本币单价2
        // OrigDiscountPrice:单价
        // OrigDiscountAmount:金额
        // DiscountPrice:本币单价
        // DiscountAmount:本币金额
        // DiscountPrice2:本币单价2
        // OrigDiscountPrice2:单价2
        var detailGrid = document.getElementById(tableName + "_div");
        detailGrid.setColVisible("OrigDiscountPrice,OrigDiscountAmount,DiscountPrice,DiscountAmount,DiscountPrice2,OrigDiscountPrice2", false);

        var detailSumGrid = document.getElementById(tableName + "_Sum_div");
        detailSumGrid.setColVisible("OrigDiscountPrice,OrigDiscountAmount,DiscountPrice,DiscountAmount,DiscountPrice2,OrigDiscountPrice2", false);

        this.setColAllowNull(tableName, "OrigDiscountPrice,OrigDiscountAmount,DiscountPrice,DiscountAmount,DiscountPrice2,OrigDiscountPrice2", true);

        var details = detailGrid.getDtoList(function (dtorow) { if (dtorow.getAttribute("EditState") != "Delete") return true; else return false; }, "Code,EditState");

        for (var i = 0, j = details.length; i < j; i++) {
            details[i].OrigTax = 0;
            details[i].Tax = 0;
            details[i].TaxRate = 0;
            details[i].TaxFlag = true;
        }
        detailGrid.updateDtoList(details);
    },

    //废旧物资发票
    ReLoadOfInvoiceType_02: function (OldInvoiceCode, tableName) {
        //都显示
        //无税得隐藏，单价，本币单价，金额，本币金额，单价2，本币单价2
        // OrigDiscountPrice:单价
        // OrigDiscountAmount:金额
        // DiscountPrice:本币单价
        // DiscountAmount:本币金额
        // DiscountPrice2:本币单价2
        // OrigDiscountPrice2:单价2
        var detailGrid = document.getElementById(tableName + "_div");
        detailGrid.setColVisible("OrigDiscountPrice,OrigDiscountAmount,DiscountPrice,DiscountAmount,DiscountPrice2,OrigDiscountPrice2", false);

        var detailSumGrid = document.getElementById(tableName + "_Sum_div");
        detailSumGrid.setColVisible("OrigDiscountPrice,OrigDiscountAmount,DiscountPrice,DiscountAmount,DiscountPrice2,OrigDiscountPrice2", false);

        this.setColAllowNull(tableName, "OrigDiscountPrice,OrigDiscountAmount,DiscountPrice,DiscountAmount,DiscountPrice2,OrigDiscountPrice2", true);
    },

    //农副产品发票
    ReLoadOfInvoiceType_03: function (OldInvoiceCode, tableName) {
        //都显示
        //无税得隐藏，单价，本币单价，金额，本币金额，单价2，本币单价2
        // OrigDiscountPrice:单价
        // OrigDiscountAmount:金额
        // DiscountPrice:本币单价
        // DiscountAmount:本币金额
        // DiscountPrice2:本币单价2
        // OrigDiscountPrice2:单价2
        var detailGrid = document.getElementById(tableName + "_div");
        detailGrid.setColVisible("OrigDiscountPrice,OrigDiscountAmount,DiscountPrice,DiscountAmount,DiscountPrice2,OrigDiscountPrice2", false);

        var detailSumGrid = document.getElementById(tableName + "_Sum_div");
        detailSumGrid.setColVisible("OrigDiscountPrice,OrigDiscountAmount,DiscountPrice,DiscountAmount,DiscountPrice2,OrigDiscountPrice2", false);

        this.setColAllowNull(tableName, "OrigDiscountPrice,OrigDiscountAmount,DiscountPrice,DiscountAmount,DiscountPrice2,OrigDiscountPrice2", true);
    },
    //收据
    ReLoadOfInvoiceType_08: function (OldInvoiceCode, tableName) {
        //所有含税的都不显示。说明：只要有税字的都隐藏
        //所有有税字的字段需要到后台判断
        // TaxRate：税率
        // OrigTaxPrice:含税单价
        // OrigTax:税额
        // OrigTaxAmount:含税金额
        // TaxPrice:本币含税单价
        // TaxAmount:本币含税金额
        // Tax:本币税额
        // Discount：本币折扣金额
        // TaxFlag:含税标识
        //税额默认等于0、本币税额默认等于0、税率为0
        var detailGrid = document.getElementById(tableName + "_div");
        detailGrid.setColVisible("TaxRate,OrigTaxPrice,OrigTax,OrigTaxAmount,TaxPrice,TaxAmount,Tax,TaxFlag", false);

        var detailSumGrid = document.getElementById(tableName + "_Sum_div");
        detailSumGrid.setColVisible("TaxRate,OrigTaxPrice,OrigTax,OrigTaxAmount,TaxPrice,TaxAmount,Tax,TaxFlag", false);

        this.setColAllowNull(tableName, "TaxRate,OrigTaxPrice,OrigTax,OrigTaxAmount,TaxPrice,TaxAmount,Tax,TaxFlag", true);

        var details = detailGrid.getDtoList(function (dtorow) { if (dtorow.getAttribute("EditState") != "Delete") return true; else return false; }, "Code,EditState");

        for (var i = 0, j = details.length; i < j; i++)
        {
                details[i].OrigTax = 0;
                details[i].Tax = 0;
                details[i].TaxRate = 0;
                details[i].TaxFlag = false;
        }
        detailGrid.updateDtoList(details);
    },
    // -------------------------------  票据类型改变算法及相关 end 
    model: function () {
    }

});

/*
 * 数量/数量验证
*/
function CheckRowQuantityValue(_ctrlInfo, colName) {
    dbg();
    // 当前行号
    var _curRowIndex = _ctrlInfo.curRowIndex;
    var grid = window['$T.Instance'].detailGrid;
    var voucher = window['$T.Instance'].Voucher;

    var busiType = $T.Get("BusiType").prop("Value");
    // 普通委外的场合
    //if (OMEnumItemData.AA_BusiType_OM63 == busiType.Code) {
    //    grid.getCol("Quantity").userPrompt = $T.Locale.Get('OM', 'ExpenseVoucherQuantityOM63Zero');
    //    grid.getCol("Quantity2").userPrompt = $T.Locale.Get('OM', 'ExpenseVoucherQuantityOM63Zero');

    //    // 数量
    //    var quantity = grid.getCellValue(_curRowIndex, "Quantity");
    //    if (quantity <= 0) {
    //        return false;
    //    }

    //}
    if (OMEnumItemData.AA_BusiType_OM64 == busiType.Code) {
        grid.getCol("Quantity").userPrompt = $T.Locale.Get('OM', 'ExpenseVoucherQuantityOM64Zero');
        grid.getCol("Quantity2").userPrompt = $T.Locale.Get('OM', 'ExpenseVoucherQuantityOM64Zero');

        // 数量
        var quantity = grid.getCellValue(_curRowIndex, "Quantity");
        if (quantity >= 0) {
            return false;
        }
    }

    var SourceVoucherBusiTypeCode = grid.getCellValue(_curRowIndex, "SourceVoucherBusiTypeCode");
    // 普通委外
    if (OMEnumItemData.AA_BusiType_OM63 == SourceVoucherBusiTypeCode) {
        var message = $T.Locale.Get('OM', 'SourceVoucherExpenseVoucherQuantityOM63Zero');
        grid.getCol("Quantity").userPrompt = message;
        grid.getCol("Quantity2").userPrompt = message;
    }
    // 委外退库
    if (OMEnumItemData.AA_BusiType_OM64 == SourceVoucherBusiTypeCode) {
        var message = $T.Locale.Get('OM', 'SourceVoucherExpenseVoucherQuantityOM64Zero');
        grid.getCol("Quantity").userPrompt = message;
        grid.getCol("Quantity2").userPrompt = message;
    }

    return true;
}
