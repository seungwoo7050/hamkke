package com.hamkke.app.billing

import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClient.BillingResponseCode
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingResult
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * 한국 대체 결제(Google Play "alternative billing only")의 앱 쪽 세 단계.
 * 결제 자체는 Stripe Checkout이 하고(웹과 같은 서버 흐름), 여기서는 Play가 요구하는
 * 것만 한다: (1) 이 사용자가 대체 결제를 쓸 수 있는지, (2) 결제 전 Google의 안내
 * 대화상자, (3) 거래마다 받는 토큰 - 서버가 결제 뒤 Play 개발자 API에 이 토큰으로
 * 거래를 보고한다(src/server/play-reporting.ts). Play Billing Library 9.1의
 * enableAlternativeBillingOnly 계열 API(6.1에서 도입, 9.1에서도 유효).
 */
@CapacitorPlugin(name = "AlternativeBilling")
class AlternativeBillingPlugin : Plugin() {
    private var client: BillingClient? = null

    // 연결이 끊겼거나 처음이면 새로 연결한 뒤 이어서 한다. 대체 결제 전용 클라이언트는
    // Play 결제를 쓰지 않으므로 구매 갱신 리스너가 필요 없다(공식 문서).
    private fun withClient(call: PluginCall, block: (BillingClient) -> Unit) {
        val ready = client
        if (ready != null && ready.isReady) {
            block(ready)
            return
        }
        val next = BillingClient.newBuilder(context).enableAlternativeBillingOnly().build()
        client = next
        next.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(result: BillingResult) {
                if (result.responseCode == BillingResponseCode.OK) {
                    block(next)
                } else {
                    call.reject(result.debugMessage, result.responseCode.toString())
                }
            }

            override fun onBillingServiceDisconnected() {
                client = null
            }
        })
    }

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        withClient(call) { billing ->
            billing.isAlternativeBillingOnlyAvailableAsync { result ->
                call.resolve(JSObject().put("available", result.responseCode == BillingResponseCode.OK))
            }
        }
    }

    // 사용자가 한 번 확인하면 이후엔 바로 OK가 돌아온다. 대화상자는 화면 스레드에서 연다.
    @PluginMethod
    fun showInformationDialog(call: PluginCall) {
        withClient(call) { billing ->
            activity.runOnUiThread {
                billing.showAlternativeBillingOnlyInformationDialog(activity) { result ->
                    call.resolve(
                        JSObject()
                            .put("ok", result.responseCode == BillingResponseCode.OK)
                            .put("code", result.responseCode),
                    )
                }
            }
        }
    }

    @PluginMethod
    fun createReportingToken(call: PluginCall) {
        withClient(call) { billing ->
            billing.createAlternativeBillingOnlyReportingDetailsAsync { result, details ->
                val token = details?.externalTransactionToken
                if (result.responseCode == BillingResponseCode.OK && token != null) {
                    call.resolve(JSObject().put("externalTransactionToken", token))
                } else {
                    call.reject(result.debugMessage, result.responseCode.toString())
                }
            }
        }
    }
}
