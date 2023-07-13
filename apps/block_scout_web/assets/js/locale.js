import moment from 'moment'
import numeral from 'numeral'
import 'numeral/locales'
import Cookies from 'js-cookie'

export const locale = Cookies.get('locale') || 'en'

moment.locale('en')
numeral.locale('en')
