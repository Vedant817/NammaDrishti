import {useLanguage} from '../context/LanguageContext';
import {simpleCopy} from '../data/simpleCopy';
export function useInterfaceCopy(){const {lang}=useLanguage();return simpleCopy[lang]||simpleCopy.en;}
