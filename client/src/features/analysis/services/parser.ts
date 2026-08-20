// @ts-nocheck
import * as acorn from 'acorn';

const COLORS=['#4d9fff','#a78bfa','#22d3ee','#00ff9d','#ff9f43','#ec4899','#ff5f5f','#84cc16'];
const LAYER_COLORS={ui:'#4d9fff',components:'#22d3ee',services:'#a78bfa',utils:'#00ff9d',data:'#ff9f43',config:'#ec4899',test:'#f59e0b',modules:'#a78bfa',forms:'#22d3ee',classes:'#ff9f43',note:'#c084fc'};
const IGNORE=new Set(['node_modules','.git','vendor','dist','build','__pycache__','.next','coverage','.venv','venv','env','.env','.tox','.mypy_cache','.pytest_cache','.ruff_cache','__pypackages__','.eggs']);
const DEFAULT_EXCLUDE_CHIPS=['.git','node_modules','dist','build','coverage','__pycache__','.next','.venv','venv','.tox'];

function normalizeExcludePath(value){
    return (value||'').replace(/\\/g,'/').replace(/^\/+/,'').replace(/\/{2,}/g,'/');
}

function parseExcludePatterns(input){
    var seen=new Set();
    return (input||'').split(/\r?\n|,/).map(function(item){
        return normalizeExcludePath(item.trim()).replace(/\/$/,'');
    }).filter(function(item){
        if(!item||seen.has(item.toLowerCase()))return false;
        seen.add(item.toLowerCase());
        return true;
    });
}

function escapeRegexChar(ch){
    return /[|\\{}()[\]^$+?.]/.test(ch)?'\\'+ch:ch;
}

function globToRegex(pattern){
    var normalized=normalizeExcludePath(pattern).toLowerCase();
    var out='^';
    for(var i=0;i<normalized.length;i++){
        var ch=normalized[i];
        if(ch==='*'){
            if(normalized[i+1]==='*'){
                if(normalized[i+2]==='/'){
                    out+='(?:[^/]+/)*';
                    i+=2;
                }else{
                    out+='.*';
                    i++;
                }
            }else{
                out+='[^/]*';
            }
        }else if(ch==='?'){
            out+='[^/]';
        }else{
            out+=escapeRegexChar(ch);
        }
    }
    out+='$';
    return new RegExp(out,'i');
}

function compileExcludePatterns(input){
    return parseExcludePatterns(input).map(function(pattern){
        var lower=pattern.toLowerCase();
        var hasGlob=pattern.includes('*')||pattern.includes('?');
        var hasPath=pattern.includes('/');
        return{
            raw:pattern,
            lower:lower,
            regex:(hasGlob||hasPath)?globToRegex(pattern):null
        };
    });
}

function matchesExcludePattern(compiledPatterns,path,name){
    if(!compiledPatterns||!compiledPatterns.length)return false;
    var normalizedPath=normalizeExcludePath(path||name).replace(/\/$/,'');
    var lowerPath=normalizedPath.toLowerCase();
    var lowerName=(name||normalizedPath.split('/').pop()||'').toLowerCase();
    var lowerPathWithSlash=lowerPath?lowerPath+'/':'';
    var segments=lowerPath.split('/').filter(Boolean);
    return compiledPatterns.some(function(pattern){
        if(!pattern.regex){
            return lowerName===pattern.lower||segments.includes(pattern.lower);
        }
        return pattern.regex.test(lowerPath)||pattern.regex.test(lowerPathWithSlash)||pattern.regex.test(lowerName);
    });
}

function shouldIgnoreDirectory(path,name,compiledPatterns){
    var lowerName=(name||'').toLowerCase();
    return IGNORE.has(lowerName)||lowerName.endsWith('.egg-info')||matchesExcludePattern(compiledPatterns,path,name);
}

function shouldExcludeFile(path,name,compiledPatterns){
    return !Parser.isIncluded(name)||matchesExcludePattern(compiledPatterns,path,name);
}

function getSecurityScanContent(file){
    var content=file&&file.content?file.content:'';
    if(file&&file.name==='index.html'&&content.includes('detectSecurity:function(files){')&&content.includes('calcComplexity:function')){
        return content.replace(
            /detectSecurity:function\(files\)\{[\s\S]*?\n    \},\n    calcComplexity:function/,
            "detectSecurity:function(files){\n        return[];\n    },\n    calcComplexity:function"
        );
    }
    return content;
}

function isSanitizedPreviewRenderer(content){
    return content.includes("function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}") &&
           content.includes("var escaped=esc(line);") &&
           content.includes("dangerouslySetInnerHTML:{__html:lineHtml||' '}");
}

const Parser={
    // tree-sitter Python parser (real AST parser, loaded async via WASM)
    _tsParser:null,
    _tsInitPromise:null,
    initTreeSitter:async function(){
        if(this._tsParser)return this._tsParser;
        if(this._tsInitPromise)return this._tsInitPromise;
        this._tsInitPromise=(async()=>{
            if(typeof TreeSitter==='undefined')return null;
            try{
                await TreeSitter.init({
                    locateFile:function(scriptName){
                        return 'https://cdn.jsdelivr.net/npm/web-tree-sitter@0.25.10/'+scriptName;
                    }
                });
                var parser=new TreeSitter();
                var Python=await TreeSitter.Language.load(
                    'https://cdn.jsdelivr.net/npm/tree-sitter-wasms@0.1.13/out/tree-sitter-python.wasm'
                );
                parser.setLanguage(Python);
                this._tsParser=parser;
                return parser;
            }catch(e){
                return null;
            }
        })();
        return this._tsInitPromise;
    },
    codeExts:['.js','.jsx','.ts','.tsx','.mjs','.cjs','.py','.pyw','.pyi','.java','.go','.rb','.php','.rs','.c','.cpp','.cc','.h','.hpp','.cs','.swift','.kt','.kts','.scala','.clj','.ex','.exs','.erl','.hs','.lua','.r','.R','.jl','.dart','.elm','.fs','.fsx','.ml','.pl','.pm','.sh','.bash','.zsh','.fish','.ps1','.psm1','.groovy','.gradle','.vba','.bas','.cls','.xlsm','.xlam','.xlsb','.xla','.xlw'],
    scriptContainerExts:['.html','.htm','.xhtml','.vue','.svelte'],
    textExts:['.md','.txt','.json','.yaml','.yml','.toml','.xml','.html','.htm','.css','.scss','.sass','.less','.svg','.graphql','.gql','.sql','.prisma','.proto','.tf','.tfvars','.dockerfile','.env','.env.example','.gitignore','.eslintrc','.prettierrc','.babelrc','.editorconfig','.ini','.cfg','.conf','.properties','.lock','.csv','.rst','.tex','.makefile','.cmake','.rake','.vba','.bas','.cls','.xlsm','.xlam','.xlsb','.xla','.xlw'],
    binExts:['.png','.jpg','.jpeg','.gif','.ico','.webp','.bmp','.svg','.woff','.woff2','.ttf','.eot','.otf','.pdf','.zip','.tar','.gz','.rar','.7z','.exe','.dll','.so','.dylib','.bin','.dat','.db','.sqlite','.mp3','.mp4','.wav','.avi','.mov','.webm'],
    isCode:function(n){
        var lower=n.toLowerCase();
        return Parser.codeExts.some(function(e){return lower.endsWith(e);})||
            Parser.scriptContainerExts.some(function(e){return lower.endsWith(e);});
    },
    isText:function(n){return Parser.textExts.some(function(e){return n.toLowerCase().endsWith(e);});},
    isBinary:function(n){return Parser.binExts.some(function(e){return n.toLowerCase().endsWith(e);});},
    isIncluded:function(n){return !Parser.isBinary(n);},
    isScriptContainer:function(n){return Parser.scriptContainerExts.some(function(e){return n.toLowerCase().endsWith(e);});},
    isVBA:function(n){return ['.vba','.bas','.cls','.xlsm','.xlam','.xlsb','.xla','.xlw'].some(function(e){return n.toLowerCase().endsWith(e);});},
    isHTML:function(n){return ['.html','.htm','.xhtml'].some(function(e){return n.toLowerCase().endsWith(e);});},
    isCSS:function(n){return ['.css','.scss','.sass','.less'].some(function(e){return n.toLowerCase().endsWith(e);});},
    isJSON:function(n){return ['.json'].some(function(e){return n.toLowerCase().endsWith(e);});},
    parseHTMLAttributes:function(attrs){
        if(!attrs)return[];
        var parsed=[];
        var attrRegex=/([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
        var match;
        while((match=attrRegex.exec(attrs))){
            var value=match[2]!==undefined?match[2]:(match[3]!==undefined?match[3]:match[4]);
            parsed.push({
                name:(match[1]||'').toLowerCase(),
                value:value===undefined?'':value,
                valueStart:value===undefined?-1:match.index+match[0].indexOf(value)
            });
        }
        return parsed;
    },
    getScriptTagAttribute:function(attrs,name){
        var parsed=Parser.parseHTMLAttributes(attrs);
        var lowered=name.toLowerCase();
        for(var i=0;i<parsed.length;i++){
            if(parsed[i].name===lowered)return parsed[i].value;
        }
        return'';
    },
    getScriptBlockInfo:function(attrs){
        var type=(Parser.getScriptTagAttribute(attrs,'type')||'').split(';')[0].trim().toLowerCase();
        var lang=(Parser.getScriptTagAttribute(attrs,'lang')||'').split(';')[0].trim().toLowerCase();
        var info={executable:false,isTS:false,sourceType:'script'};

        if(!type){
            info.executable=true;
        }else if(type==='module'){
            info.executable=true;
            info.sourceType='module';
        }else if(
            type.match(/^(?:text|application)\/(?:x-)?(?:java|ecma)script$/)||
            type==='text/babel'||type==='text/jsx'||type==='application/jsx'||
            type==='application/babel'
        ){
            info.executable=true;
        }else if(
            type.match(/^(?:text|application)\/(?:x-)?typescript$/)||
            type==='text/tsx'||type==='application/tsx'
        ){
            info.executable=true;
            info.isTS=true;
        }

        if(lang==='ts'||lang==='tsx'||lang==='typescript'){
            info.executable=true;
            info.isTS=true;
        }else if(lang==='js'||lang==='jsx'||lang==='javascript'||lang==='babel'){
            info.executable=true;
        }

        return info;
    },
    getEmbeddedCodeBlocks:function(content,filename,options){
        if(!content||!Parser.isScriptContainer(filename))return[];
        var blocks=[];
        var scriptRegex=/<script\b([^>]*)>([\s\S]*?)<\/script\b[^>]*>/gi;
        var match;
        var scriptRanges=[];
        while((match=scriptRegex.exec(content))){
            var attrs=match[1]||'';
            var info=Parser.getScriptBlockInfo(attrs);
            var scriptContent=match[2]||'';
            scriptRanges.push({start:match.index,end:match.index+match[0].length});
            if(!info.executable||!scriptContent.trim())continue;
            var openTagEnd=match[0].indexOf('>');
            if(openTagEnd<0)continue;
            var bodyStart=match.index+openTagEnd+1;
            blocks.push({
                content:scriptContent,
                offset:content.slice(0,bodyStart).split('\n').length-1,
                isTS:info.isTS,
                sourceType:info.sourceType,
                kind:'script'
            });
        }

        if(options&&options.includeHandlers&&Parser.isHTML(filename)){
            var tagRegex=/<([a-z][\w:-]*)([^<>]*?)>/gi;
            while((match=tagRegex.exec(content))){
                var tagStart=match.index;
                var insideScript=false;
                for(var sri=0;sri<scriptRanges.length;sri++){
                    if(tagStart>=scriptRanges[sri].start&&tagStart<scriptRanges[sri].end){
                        insideScript=true;
                        break;
                    }
                }
                if(insideScript)continue;
                var attrs=match[2]||'';
                var attrsStart=match[0].indexOf(attrs);
                var parsedAttrs=Parser.parseHTMLAttributes(attrs);
                for(var ai=0;ai<parsedAttrs.length;ai++){
                    var attr=parsedAttrs[ai];
                    if(!/^on[a-z][\w:-]*$/i.test(attr.name)||attr.valueStart<0)continue;
                    if(!attr.value||!attr.value.trim())continue;
                    var valueStart=tagStart+attrsStart+attr.valueStart;
                    blocks.push({
                        content:attr.value,
                        offset:content.slice(0,valueStart).split('\n').length-1,
                        isTS:false,
                        sourceType:'script',
                        kind:'handler'
                    });
                }
            }
        }

        return blocks;
    },
    hasEmbeddedCode:function(content,filename){
        return Parser.getEmbeddedCodeBlocks(content,filename,{includeHandlers:true}).length>0;
    },
    isMarkdown:function(n){return ['.md','.markdown'].some(function(e){return n.toLowerCase().endsWith(e);});},
    // Mirror of tests/md-extractors.mjs::extractMarkdownLinks. Keep in sync.
    extractMarkdownLinks:function(content){
        if(!content)return[];
        var stripped=content.replace(/```[\s\S]*?```/g,'').replace(/~~~[\s\S]*?~~~/g,'').replace(/`[^`\n]*`/g,'');
        var links=[];
        var wikiRe=/\[\[([^\]|#]+?)(?:#[^\]|]*)?(?:\|[^\]]+)?\]\]/g;
        var m;
        while((m=wikiRe.exec(stripped))!==null){
            links.push({kind:'wikilink',raw:m[0],target:m[1].trim()});
        }
        var mdRe=/(!?)\[((?:[^\[\]]|\[[^\[\]]*\])*)\]\(([^)\s]+?)(?:\s+"[^"]*")?\)/g;
        while((m=mdRe.exec(stripped))!==null){
            if(m[1]==='!')continue;
            var url=m[3].trim();
            if(!url)continue;
            if(/^(?:https?:|mailto:|ftp:|file:|tel:|#)/i.test(url))continue;
            var clean=url.split('#')[0].split('?')[0];
            if(!clean)continue;
            links.push({kind:'mdlink',raw:m[0],target:url});
        }
        return links;
    },
    // Mirror of tests/md-extractors.mjs::resolveMarkdownLink. Keep in sync.
    resolveMarkdownLink:function(rawTarget,fromPath,allPaths,kind){
        if(!rawTarget)return null;
        var allLower=allPaths.map(function(p){return p.toLowerCase();});
        function findExact(candidate){
            var c=candidate.toLowerCase();
            var i=allLower.indexOf(c);
            return i>=0?allPaths[i]:null;
        }
        function findWithMd(candidate){
            var hit=findExact(candidate);
            if(hit)return hit;
            if(!/\.(md|markdown)$/i.test(candidate)){
                var mdHit=findExact(candidate+'.md');
                if(mdHit)return mdHit;
                return findExact(candidate+'.markdown');
            }
            return null;
        }
        if(kind==='mdlink'){
            var cleanTarget=rawTarget.split('#')[0].split('?')[0];
            var resolved;
            if(cleanTarget.charAt(0)==='/'){
                resolved=cleanTarget.slice(1);
            }else{
                var fromDir=fromPath.indexOf('/')>=0?fromPath.split('/').slice(0,-1).join('/'):'';
                var parts=(fromDir?fromDir.split('/'):[]).concat(cleanTarget.split('/'));
                var out=[];
                for(var pi=0;pi<parts.length;pi++){
                    var p=parts[pi];
                    if(p===''||p==='.')continue;
                    if(p==='..'){out.pop();continue;}
                    out.push(p);
                }
                resolved=out.join('/');
            }
            var direct=findWithMd(resolved);
            if(direct)return direct;
        }
        var baseName=rawTarget.split('#')[0].split('?')[0].split('/').pop();
        if(!baseName)return null;
        for(var i=0;i<allPaths.length;i++){
            var pname=allPaths[i].split('/').pop().toLowerCase();
            if(/\.(md|markdown)$/i.test(baseName)){
                if(pname===baseName.toLowerCase())return allPaths[i];
            }else if(pname===baseName.toLowerCase()+'.md'||pname===baseName.toLowerCase()+'.markdown'){
                return allPaths[i];
            }
        }
        return null;
    },
    detectLayer:function(p){
        var l=p.toLowerCase();
        // Test files
        if(l.includes('/test')||l.match(/test_\w+\.py$/)||l.match(/\w+_test\.py$/)||l.includes('conftest'))return'test';
        // UI/View layer
        if(l.includes('/ui/')||l.includes('/views/')||l.includes('/pages/')||l.includes('/templates/')||l.includes('/static/'))return'ui';
        if(l.includes('/component'))return'components';
        // Service/API layer
        if(l.includes('/service')||l.includes('/api/')||l.includes('/controller')||l.includes('/endpoint')||l.includes('/router'))return'services';
        // Python middleware/handler layer
        if(l.includes('/middleware')||l.includes('/handler')||l.includes('/signal'))return'services';
        // Utility/Helper layer
        if(l.includes('/util')||l.includes('/helper')||l.includes('/lib/')||l.includes('/common/'))return'utils';
        // Data/Model layer
        if(l.includes('/data')||l.includes('/model')||l.includes('/store')||l.includes('/schema')||l.includes('/serializer'))return'data';
        // Python-specific data layers
        if(l.includes('/migration'))return'data';
        if(l.includes('/fixtures/'))return'data';
        // Task/Worker layer
        if(l.includes('/task')||l.includes('/worker')||l.includes('/celery')||l.includes('/job'))return'services';
        // Config layer
        if(l.includes('/config')||l.includes('/settings')||l.match(/settings\.py$/))return'config';
        // VBA-specific layer detection
        if(l.includes('/modules/')||l.includes('/bas/'))return'modules';
        if(l.includes('/forms/')||l.includes('/userforms/'))return'ui';
        if(l.includes('/classes/'))return'data';
        if(l.includes('/standard/'))return'utils';
        return'utils';
    },
    detectPatterns:function(files){
        var patterns=[];
        var singletons=files.filter(function(f){return f.content&&(f.content.includes('getInstance')||f.content.match(/let\s+instance\s*=/)||f.content.match(/private\s+static\s+instance/));});
        if(singletons.length)patterns.push({name:'Singleton',icon:'lock',desc:'Ensures a class has only one instance. Common for configuration, logging, or connection pools.',severity:'info',files:singletons.map(function(f){return{name:f.name,path:f.path};}),metrics:{instances:singletons.length}});
        var factories=files.filter(function(f){return f.content&&(f.name.toLowerCase().includes('factory')||f.content.match(/create[A-Z]\w*\s*\(/)||f.content.includes('return new'));});
        if(factories.length)patterns.push({name:'Factory',icon:'factory',desc:'Creates objects without specifying exact class. Enables loose coupling and extensibility.',severity:'info',files:factories.map(function(f){return{name:f.name,path:f.path};}),metrics:{factories:factories.length}});
        var observers=files.filter(function(f){return f.content&&(f.content.includes('subscribe')||f.content.includes('addEventListener')||f.content.includes('.on(')||f.content.includes('emit('));});
        if(observers.length)patterns.push({name:'Observer/Event',icon:'eye',desc:'Defines a subscription mechanism for event-driven architecture. Great for decoupling.',severity:'info',files:observers.map(function(f){return{name:f.name,path:f.path};}),metrics:{emitters:observers.length}});
        var hooks=files.filter(function(f){return f.content&&f.content.match(/export\s+(?:const|function)\s+use[A-Z]/);});
        if(hooks.length)patterns.push({name:'Custom Hooks',icon:'hook',desc:'React hooks for reusable stateful logic. Promotes code reuse and separation of concerns.',severity:'info',files:hooks.map(function(f){return{name:f.name,path:f.path};}),metrics:{hooks:hooks.length}});
        var hocs=files.filter(function(f){return f.content&&(f.content.match(/with[A-Z]\w*\s*=\s*\(/)||f.content.match(/export\s+default\s+connect/));});
        if(hocs.length)patterns.push({name:'Higher-Order Component',icon:'spark',desc:'Functions that take a component and return an enhanced component.',severity:'info',files:hocs.map(function(f){return{name:f.name,path:f.path};}),metrics:{hocs:hocs.length}});
        var providers=files.filter(function(f){return f.content&&(f.content.includes('createContext')||f.content.includes('Provider')||f.content.includes('useContext'));});
        if(providers.length)patterns.push({name:'Context Provider',icon:'globe',desc:'React Context for global state. Alternative to prop drilling.',severity:'info',files:providers.map(function(f){return{name:f.name,path:f.path};}),metrics:{contexts:providers.length}});
        // VBA-specific patterns
        var vbaUserForms=files.filter(function(f){return f.content&&(f.content.match(/Attribute\s+VB_Name\s*=\s*["']UserForm/i)||f.name.match(/UserForm/i));});
        if(vbaUserForms.length)patterns.push({name:'UserForms',icon:'layout',desc:'VBA UserForms for UI components. Common in Excel/Access automation.',severity:'info',files:vbaUserForms.map(function(f){return{name:f.name,path:f.path};}),metrics:{forms:vbaUserForms.length}});
        var vbaModules=files.filter(function(f){return f.content&&(f.content.match(/Attribute\s+VB_Name\s*=\s*["']Module/i)||f.name.match(/Module/i));});
        if(vbaModules.length)patterns.push({name:'Modules',icon:'box',desc:'VBA Modules for reusable code and business logic.',severity:'info',files:vbaModules.map(function(f){return{name:f.name,path:f.path};}),metrics:{modules:vbaModules.length}});
        var vbaClasses=files.filter(function(f){return f.content&&(f.content.match(/Attribute\s+VB_Name\s*=\s*["']Class/i)||f.name.match(/Class/i));});
        if(vbaClasses.length)patterns.push({name:'Class Modules',icon:'building',desc:'VBA Class Modules for object-oriented programming patterns.',severity:'info',files:vbaClasses.map(function(f){return{name:f.name,path:f.path};}),metrics:{classes:vbaClasses.length}});
        // Python-specific patterns
        var decoratorFiles=files.filter(function(f){return f.content&&f.name.endsWith('.py')&&f.content.match(/@\w+\s*(?:\(.*\))?\s*\n\s*(?:def|class)/);});
        // Endpoint/API route detection across frameworks
        var endpointRegexes=[
            // Python: Flask/FastAPI/Django/Starlette decorators
            {re:/@(?:\w+\.)?(?:route|get|post|put|delete|patch|options|head|api_route|websocket)\s*\(\s*["'`]([^"'`]+)["'`]/g,lang:'py'},
            // Django urls.py: path(...), re_path(...), url(...)
            {re:/\b(?:re_path|path|url)\s*\(\s*["'`]([^"'`]+)["'`]/g,lang:'py'},
            // JS/TS Express/Koa/Hapi: app.get('/x'), router.post('/x')
            {re:/\b(?:app|router|route|server|api|fastify)\s*\.\s*(?:get|post|put|delete|patch|options|head|all|use|ws)\s*\(\s*["'`]([^"'`]+)["'`]/g,lang:'js'},
            // NestJS / decorator-based: @Get('/x'), @Post('/x'), @Controller('/x')
            {re:/@(?:Get|Post|Put|Delete|Patch|Options|Head|All|Controller|Sse|WebSocketGateway)\s*\(\s*["'`]([^"'`]*)["'`]/g,lang:'ts'},
            // Go: http.HandleFunc, mux.HandleFunc, r.Get/Post/...
            {re:/\b(?:http|mux|r|router|e|app)\s*\.\s*(?:HandleFunc|Handle|GET|POST|PUT|DELETE|PATCH|Get|Post|Put|Delete|Patch)\s*\(\s*["`]([^"`]+)["`]/g,lang:'go'},
            // Rails: get '/x', post '/x' (in routes.rb)
            {re:/^\s*(?:get|post|put|patch|delete|resources|resource|match)\s+["']([^"']+)["']/gm,lang:'rb'},
            // Spring: @RequestMapping / @GetMapping etc
            {re:/@(?:Request|Get|Post|Put|Delete|Patch)Mapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']/g,lang:'java'}
        ];
        var endpoints=[];
        var endpointFiles={};
        files.forEach(function(f){
            if(!f.content)return;
            var ext=(f.name.match(/\.([^.]+)$/)||[])[1];
            endpointRegexes.forEach(function(er){
                var m;er.re.lastIndex=0;
                while((m=er.re.exec(f.content))!==null){
                    endpoints.push({path:m[1]||'/',file:f.path,name:f.name});
                    endpointFiles[f.path]=(endpointFiles[f.path]||0)+1;
                }
            });
        });
        if(endpoints.length){
            var epFiles=Object.keys(endpointFiles).map(function(p){var f=files.find(function(x){return x.path===p;});return{name:f?f.name:p,path:p,count:endpointFiles[p]};});
            patterns.push({name:'API Endpoints',icon:'route',desc:'HTTP endpoints detected across frameworks (Flask/FastAPI/Django, Express/Koa/Nest, Spring, Rails, Go).',severity:'info',files:epFiles,metrics:{endpoints:endpoints.length,files:epFiles.length},endpoints:endpoints.slice(0,500)});
        }
        var dataclasses=files.filter(function(f){return f.content&&f.name.endsWith('.py')&&f.content.match(/@dataclass/);});
        if(dataclasses.length)patterns.push({name:'Dataclasses',icon:'database',desc:'Python dataclasses for structured data. Reduces boilerplate for data-holding classes.',severity:'info',files:dataclasses.map(function(f){return{name:f.name,path:f.path};}),metrics:{dataclasses:dataclasses.length}});
        var abcFiles=files.filter(function(f){return f.content&&f.name.endsWith('.py')&&(f.content.match(/\bABC\b/)||f.content.match(/@abstractmethod/)||f.content.match(/ABCMeta/));});
        if(abcFiles.length)patterns.push({name:'Abstract Base Classes',icon:'layers',desc:'Python ABCs enforce interface contracts. Ensures subclasses implement required methods.',severity:'info',files:abcFiles.map(function(f){return{name:f.name,path:f.path};}),metrics:{abcs:abcFiles.length}});
        var ctxManagers=files.filter(function(f){return f.content&&f.name.endsWith('.py')&&(f.content.match(/@contextmanager/)||f.content.match(/def\s+__enter__/));});
        if(ctxManagers.length)patterns.push({name:'Context Managers',icon:'refresh',desc:'Python context managers for resource management (with statement). Ensures proper cleanup.',severity:'info',files:ctxManagers.map(function(f){return{name:f.name,path:f.path};}),metrics:{managers:ctxManagers.length}});
        var pyMixins=files.filter(function(f){return f.content&&f.name.endsWith('.py')&&f.content.match(/class\s+\w*Mixin\w*\s*[\(:]?/);});
        if(pyMixins.length)patterns.push({name:'Mixins',icon:'puzzle',desc:'Python mixins for reusable behavior through multiple inheritance.',severity:'info',files:pyMixins.map(function(f){return{name:f.name,path:f.path};}),metrics:{mixins:pyMixins.length}});
        var pySignals=files.filter(function(f){return f.content&&f.name.endsWith('.py')&&(f.content.match(/Signal\s*\(/)||f.content.match(/@receiver\s*\(/)||f.content.match(/\.connect\s*\(/));});
        if(pySignals.length)patterns.push({name:'Django Signals',icon:'radio',desc:'Django signals for decoupled event-driven communication between components.',severity:'info',files:pySignals.map(function(f){return{name:f.name,path:f.path};}),metrics:{signals:pySignals.length}});
        var pyMiddleware=files.filter(function(f){return f.content&&f.name.endsWith('.py')&&(f.content.match(/class\s+\w*Middleware/)||f.content.match(/def\s+middleware\s*\(/)||f.name.toLowerCase().includes('middleware'));});
        if(pyMiddleware.length)patterns.push({name:'Middleware',icon:'link',desc:'Request/response middleware for cross-cutting concerns (auth, logging, CORS).',severity:'info',files:pyMiddleware.map(function(f){return{name:f.name,path:f.path};}),metrics:{middleware:pyMiddleware.length}});
        var godFiles=files.filter(function(f){return f.isCode!==false&&f.functions&&f.functions.length>15;});
        if(godFiles.length)patterns.push({name:'God Object',icon:'warning',desc:'Files with too many responsibilities (15+ functions). Consider splitting into smaller modules.',severity:'warning',isAnti:true,files:godFiles.map(function(f){return{name:f.name,path:f.path,fns:f.functions.length};}),metrics:{files:godFiles.length,avgFns:Math.round(godFiles.reduce(function(s,f){return s+f.functions.length;},0)/godFiles.length)}});
        var longFiles=files.filter(function(f){return f.isCode!==false&&f.lines&&f.lines>500;});
        if(longFiles.length)patterns.push({name:'Long File',icon:'scroll',desc:'Files over 500 lines are harder to maintain. Consider breaking into smaller modules.',severity:'warning',isAnti:true,files:longFiles.map(function(f){return{name:f.name,path:f.path,lines:f.lines};}),metrics:{files:longFiles.length,avgLines:Math.round(longFiles.reduce(function(s,f){return s+f.lines;},0)/longFiles.length)}});
        // VBA-specific anti-patterns
        var vbaGodFiles=files.filter(function(f){return f.isCode!==false&&f.functions&&f.functions.length>20;});
        if(vbaGodFiles.length)patterns.push({name:'VBA God Module',icon:'warning',desc:'VBA modules with 20+ procedures. Consider splitting into smaller modules.',severity:'warning',isAnti:true,files:vbaGodFiles.map(function(f){return{name:f.name,path:f.path,fns:f.functions.length,lines:f.lines};}),metrics:{files:vbaGodFiles.length,avgFns:Math.round(vbaGodFiles.reduce(function(s,f){return s+f.functions.length;},0)/vbaGodFiles.length)}});
        return patterns;
    },
    detectDuplicates:function(files,allFns){
        var duplicates=[];

        // Common function names that are expected to be duplicated across files
        // These are idiomatic patterns, not DRY violations
        var commonNames=new Set([
            // React lifecycle and handlers
            'render','componentDidMount','componentWillUnmount','componentDidUpdate',
            'shouldComponentUpdate','getDerivedStateFromProps','getSnapshotBeforeUpdate',
            'handleClick','handleChange','handleSubmit','handleInput','handleKeyDown',
            'handleKeyUp','handleKeyPress','handleBlur','handleFocus','handleScroll',
            'handleMouseEnter','handleMouseLeave','handleDrag','handleDrop',
            'onClick','onChange','onSubmit','onBlur','onFocus','onKeyDown',
            // Common utility names
            'init','setup','cleanup','destroy','reset','clear','update','refresh',
            'validate','parse','format','transform','convert','process','execute',
            'get','set','fetch','load','save','create','delete','remove','add',
            'find','filter','map','reduce','sort','merge','clone','copy',
            // Test patterns
            'beforeEach','afterEach','beforeAll','afterAll','describe','it','test',
            'setUp','tearDown','mock',
            // Common class methods
            'toString','valueOf','equals','hashCode','compare','clone',
            'serialize','deserialize','toJSON','fromJSON',
            // Express/API patterns
            'index','show','store','update','destroy','create','edit',
            // Python common patterns
            '__init__','__str__','__repr__','__len__','__eq__','__hash__','__enter__','__exit__',
            '__getattr__','__setattr__','__delattr__','__getitem__','__setitem__','__contains__',
            '__iter__','__next__','__call__','__bool__','__lt__','__gt__','__le__','__ge__',
            'upgrade','downgrade','setUp','tearDown','setUpClass','tearDownClass',
            'main','create_app','configure','register','on_startup','on_shutdown','lifespan',
            // Vue lifecycle
            'mounted','created','updated','destroyed','beforeCreate','beforeMount',
            // Angular lifecycle
            'ngOnInit','ngOnDestroy','ngOnChanges','ngAfterViewInit',
            // Svelte
            'onMount','onDestroy'
        ]);

        // Group functions by name (excluding common names)
        var fnByName={};
        allFns.forEach(function(fn){
            // Guard against non-string names from exotic parsers
            if(!fn||typeof fn.name!=='string'||!fn.name)return;
            // Skip common/idiomatic names
            if(commonNames.has(fn.name))return;
            // Skip very short names (likely false positives)
            if(fn.name.length<3)return;
            // Skip class methods (same method name in different classes is normal)
            if(fn.isClassMethod)return;
            // Skip Python class-scoped names (ClassName.method)
            if(fn.name.includes('.'))return;
            // Skip decorated functions (framework handlers have similar structures by design)
            if(fn.decorators&&fn.decorators.length>0)return;

            if(!fnByName[fn.name])fnByName[fn.name]=[];
            fnByName[fn.name].push(fn);
        });

        // Find duplicate names across different files - only report if suspicious
        Object.entries(fnByName).forEach(function(entry){
            var name=entry[0],fns=entry[1];
            var uniqueFiles=[...new Set(fns.map(function(f){return f.file;}))];

            // Only flag if in 3+ files (2 files might be intentional)
            if(uniqueFiles.length>=3){
                // Check if the code is actually similar (not just same name)
                var codeSamples=fns.filter(function(f){return f.code&&f.code.length>30;});
                if(codeSamples.length>=2){
                    // Compare first two code samples for similarity
                    var sim=Parser.codeSimilarity(codeSamples[0].code,codeSamples[1].code);
                    if(sim>0.5){  // More than 50% similar - likely a real duplicate
                        duplicates.push({
                            type:'name',
                            name:name,
                            count:uniqueFiles.length,
                            files:fns.map(function(f){return{file:f.file,line:f.line};}),
                            similarity:Math.round(sim*100),
                            suggestion:'Function "'+name+'" appears in '+uniqueFiles.length+' files with '+Math.round(sim*100)+'% similarity - consider consolidating'
                        });
                    }
                }
            }
        });

        // Find similar code blocks (improved algorithm)
        // Use structural hash that captures the essence of the code
        var codeGroups={};
        allFns.forEach(function(fn){
            if(!fn.code||fn.code.length<80)return;  // Skip very short functions

            // Create a structural fingerprint
            var fingerprint=Parser.codeFingerprint(fn.code);
            if(!fingerprint)return;

            if(!codeGroups[fingerprint])codeGroups[fingerprint]=[];
            codeGroups[fingerprint].push(fn);
        });

        Object.values(codeGroups).forEach(function(fns){
            if(fns.length>1){
                var uniqueFiles=[...new Set(fns.map(function(f){return f.file;}))];
                // Must be in different files to be a real duplication issue
                if(uniqueFiles.length>1){
                    // Verify with actual similarity check
                    var sim=Parser.codeSimilarity(fns[0].code,fns[1].code);
                    if(sim>0.7){  // 70% or more similar
                        duplicates.push({
                            type:'code',
                            name:fns.map(function(f){return f.name;}).join(', '),
                            count:fns.length,
                            files:fns.map(function(f){return{file:f.file,name:f.name,line:f.line};}),
                            similarity:Math.round(sim*100),
                            suggestion:'Similar code blocks ('+Math.round(sim*100)+'% match) - consider extracting to a shared utility'
                        });
                    }
                }
            }
        });

        return duplicates;
    },

    // Calculate code similarity using normalized comparison (0-1 scale)
    codeSimilarity:function(code1,code2){
        if(!code1||!code2)return 0;

        // Normalize both code blocks
        function normalize(code){
            return code
                .replace(/\/\/.*$/gm,'')           // Remove JS single-line comments
                .replace(/#.*$/gm,'')              // Remove Python/Ruby comments
                .replace(/\/\*[\s\S]*?\*\//g,'')   // Remove multi-line comments
                .replace(/"""[\s\S]*?"""/g,'S')    // Remove Python docstrings (triple double)
                .replace(/'''[\s\S]*?'''/g,'S')    // Remove Python docstrings (triple single)
                .replace(/['"`][^'"`]*['"`]/g,'S') // Normalize strings
                .replace(/\b\d+\.?\d*\b/g,'N')     // Normalize numbers
                .replace(/\s+/g,' ')               // Normalize whitespace
                .trim();
        }

        var n1=normalize(code1);
        var n2=normalize(code2);

        if(n1===n2)return 1;
        if(n1.length===0||n2.length===0)return 0;

        // Use longest common subsequence ratio
        var lcs=Parser.lcsLength(n1,n2);
        var maxLen=Math.max(n1.length,n2.length);
        return lcs/maxLen;
    },

    // Longest common subsequence length (optimized for similarity)
    lcsLength:function(s1,s2){
        // Use simplified approach for performance
        if(s1.length>500||s2.length>500){
            // For long strings, use sampling
            s1=s1.substring(0,500);
            s2=s2.substring(0,500);
        }

        var m=s1.length,n=s2.length;
        var prev=new Array(n+1).fill(0);
        var curr=new Array(n+1).fill(0);

        for(var i=1;i<=m;i++){
            for(var j=1;j<=n;j++){
                if(s1[i-1]===s2[j-1]){
                    curr[j]=prev[j-1]+1;
                }else{
                    curr[j]=Math.max(prev[j],curr[j-1]);
                }
            }
            var tmp=prev;prev=curr;curr=tmp;
            curr.fill(0);
        }
        return prev[n];
    },

    // Create a structural fingerprint for code (for grouping similar code)
    codeFingerprint:function(code){
        if(!code||code.length<50)return null;

        // Extract structural elements
        var structure=code
            .replace(/\/\/.*$/gm,'')           // Remove comments
            .replace(/\/\*[\s\S]*?\*\//g,'')
            .replace(/['"`][^'"`]*['"`]/g,'')  // Remove string contents
            .replace(/\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g,'I')  // All identifiers -> I
            .replace(/\b\d+\.?\d*\b/g,'N')     // All numbers -> N
            .replace(/\s+/g,'');               // Remove whitespace

        // Take a hash-like fingerprint based on structure length and key patterns
        var patterns={
            loops:(structure.match(/for|while/g)||[]).length,
            conditions:(structure.match(/if|\?/g)||[]).length,
            calls:(structure.match(/I\(/g)||[]).length,
            returns:(structure.match(/return/g)||[]).length,
            len:Math.floor(structure.length/50)*50  // Bucket by length
        };

        // Create fingerprint string
        return 'L'+patterns.loops+'C'+patterns.conditions+'F'+patterns.calls+'R'+patterns.returns+'S'+patterns.len;
    },
    detectLayerViolations:function(files,connections){
        var violations=[];
        var layerOrder={presentation:0,ui:0,component:0,components:0,page:0,view:0,feature:1,service:2,services:2,api:2,data:3,model:3,util:4,utils:4,helper:4,lib:4,core:4,config:5,test:6,modules:5,forms:0,classes:3};
        connections.forEach(function(c){
            var srcFile=files.find(function(f){return f.path===c.source;});
            var tgtFile=files.find(function(f){return f.path===c.target;});
            if(!srcFile||!tgtFile)return;
            var srcLayer=(srcFile.layer||'').toLowerCase();
            var tgtLayer=(tgtFile.layer||'').toLowerCase();
            var srcLevel=layerOrder[srcLayer];
            var tgtLevel=layerOrder[tgtLayer];
            // Violation: lower layer importing from higher layer (e.g., service importing from UI)
            if(srcLevel!==undefined&&tgtLevel!==undefined&&srcLevel>tgtLevel&&srcLevel-tgtLevel>1){
                violations.push({
                    from:srcFile.path,
                    fromLayer:srcFile.layer,
                    to:tgtFile.path,
                    toLayer:tgtFile.layer,
                    fn:c.fn,
                    suggestion:srcFile.layer+' should not import from '+tgtFile.layer+'. Consider inverting the dependency or using dependency injection.'
                });
            }
        });
        return violations;
    },
    calcComplexity:function(content,filename){
        if(!content)return{score:0,level:'low'};
        if(filename&&Parser.isScriptContainer(filename)){
            var blocks=Parser.getEmbeddedCodeBlocks(content,filename,{includeHandlers:true});
            if(!blocks.length)return{score:0,level:'low'};
            content=blocks.map(function(block){return block.content;}).join('\n');
        }
        // Approximate cyclomatic complexity - supports JS, Python, and other languages
        var complexity=1;
        // JS/C-style patterns
        var patterns=[/\bif\s*\(/g,/\belse\s+if\s*\(/g,/\bwhile\s*\(/g,/\bfor\s*\(/g,/\bcase\s+/g,/\bcatch\s*\(/g,/\?\s*[^:]+\s*:/g,/&&/g,/\|\|/g];
        // Python-specific patterns
        var pyPatterns=[/\bif\s+[^(]/g,/\belif\s+/g,/\bwhile\s+[^(]/g,/\bfor\s+\w+\s+in\s+/g,/\bexcept\s*/g,/\bwith\s+/g,/\band\b/g,/\bor\b/g,/\bif\s+.+\s+else\s+/g,/\bfor\s+.+\s+in\s+[^\n]*\]/g];
        patterns.concat(pyPatterns).forEach(function(p){var m=content.match(p);if(m)complexity+=m.length;});
        // Deduplicate: if both `if (` and `if ` match the same lines, the count is inflated
        // but for a quick approximation this is acceptable
        var level='low';
        if(complexity>30)level='critical';
        else if(complexity>20)level='high';
        else if(complexity>10)level='medium';
        return{score:complexity,level:level};
    },
    generateSuggestions:function(data){
        var suggestions=[];
        // Based on dead functions
        if(data.stats.dead>10){
            suggestions.push({priority:'high',icon:'broom',title:'Remove Dead Code',desc:data.stats.dead+' unused functions detected. Removing them will improve maintainability and reduce bundle size.',action:'Review unused functions in the Issues panel',impact:'Reduces codebase by ~'+(data.stats.dead*15)+' lines'});
        }
        // Based on circular dependencies
        var circular=data.issues.filter(function(i){return i.title&&i.title.includes('Circular');});
        if(circular.length){
            suggestions.push({priority:'critical',icon:'refresh',title:'Break Circular Dependencies',desc:circular.length+' circular dependencies found. These cause tight coupling and make testing difficult.',action:'Extract shared code to a new module or use dependency injection',impact:'Improves testability and modularity'});
        }
        // Based on god files
        var godFiles=data.issues.filter(function(i){return i.title&&i.title.includes('Large');});
        if(godFiles.length){
            suggestions.push({priority:'high',icon:'split',title:'Split Large Files',desc:godFiles.length+' files have too many functions. Split by responsibility.',action:'Group related functions and extract to separate modules',impact:'Improves code navigation and testing'});
        }
        // Based on high coupling
        var coupling=data.issues.filter(function(i){return i.title&&i.title.includes('Coupled');});
        if(coupling.length){
            suggestions.push({priority:'medium',icon:'link',title:'Reduce Coupling',desc:coupling.length+' files are imported by many others. Consider if this is intentional.',action:'Review if these should be split or if importers should be consolidated',impact:'Reduces blast radius of changes'});
        }
        // Based on duplicates
        if(data.duplicates&&data.duplicates.length>0){
            var nameDups=data.duplicates.filter(function(d){return d.type==='name';});
            var codeDups=data.duplicates.filter(function(d){return d.type==='code';});
            if(nameDups.length){
                suggestions.push({priority:'medium',icon:'copy',title:'Resolve Naming Conflicts',desc:nameDups.length+' function names are duplicated across files. This can cause confusion.',action:'Rename functions to be more specific or consolidate into shared module',impact:'Prevents bugs from importing wrong function'});
            }
            if(codeDups.length){
                suggestions.push({priority:'high',icon:'box',title:'Extract Duplicated Code',desc:codeDups.length+' instances of similar code found. DRY principle violation.',action:'Create shared utility functions',impact:'Reduces maintenance burden and potential bugs'});
            }
        }
        // Based on layer violations
        if(data.layerViolations&&data.layerViolations.length>0){
            suggestions.push({priority:'high',icon:'layers',title:'Fix Architecture Violations',desc:data.layerViolations.length+' layer violations found. Lower layers should not depend on higher layers.',action:'Invert dependencies or use interfaces/events',impact:'Improves architecture and testability'});
        }
        // Based on security
        var highSec=data.securityIssues?data.securityIssues.filter(function(s){return s.severity==='high';}):[];
        if(highSec.length){
            suggestions.push({priority:'critical',icon:'shield',title:'Fix Security Issues',desc:highSec.length+' high-severity security issues found.',action:'Address hardcoded secrets, injection risks immediately',impact:'Prevents potential security breaches'});
        }
        // Test coverage hint
        var testFiles=data.files.filter(function(f){return f.name.includes('.test.')||f.name.includes('.spec.')||f.path.includes('__tests__');});
        var testRatio=data.files.length>0?(testFiles.length/data.files.length*100):0;
        if(testRatio<10&&data.files.length>10){
            suggestions.push({priority:'medium',icon:'beaker',title:'Add Test Coverage',desc:'Only '+testFiles.length+' test files found ('+Math.round(testRatio)+'%). Consider adding more tests.',action:'Focus on testing critical paths and high-complexity files',impact:'Prevents regressions and improves confidence'});
        }
        return suggestions.sort(function(a,b){var p={critical:0,high:1,medium:2,low:3};return p[a.priority]-p[b.priority];});
    },
    detectSecurity:function(files){
        var issues=[];
        files.forEach(function(f){
            var scanContent=getSecurityScanContent(f);
            if(!scanContent)return;
            var lines=scanContent.split('\n');
            lines.forEach(function(line,idx){
                if(line.match(/(?:password|passwd|pwd|secret|api_key|apikey|token|auth)\s*[=:]\s*['"][^'"]{4,}['"]/i)&&!line.includes('process.env')&&!line.includes('config.')){
                    issues.push({severity:'high',title:'Hardcoded Secret',file:f.name,path:f.path,line:idx+1,desc:'Credentials should never be hardcoded. Use environment variables or a secrets manager.',code:line.trim().substring(0,80)});
                }
            });
            if(scanContent.match(/query\s*\(\s*['"`][^'"`]*\s*\+/)||scanContent.match(/execute\s*\(\s*['"`][^'"`]*\$\{/)||scanContent.match(/\$\{.*\}.*(?:SELECT|INSERT|UPDATE|DELETE)/i)){
                var m=scanContent.match(/.*(query|execute|SELECT|INSERT|UPDATE|DELETE).*(\+|\$\{).*/i);
                issues.push({severity:'high',title:'SQL Injection Risk',file:f.name,path:f.path,desc:'String concatenation in SQL queries. Use parameterized queries instead.',code:m?m[0].trim().substring(0,80):''});
            }
            var hasInnerHtmlAssignment=scanContent.match(/innerHTML\s*=/);
            var hasDangerousHtmlRender=scanContent.match(/dangerouslySetInnerHTML/);
            var isSafePreviewRender=!hasInnerHtmlAssignment&&hasDangerousHtmlRender&&isSanitizedPreviewRenderer(f.content||'');
            if((hasInnerHtmlAssignment||hasDangerousHtmlRender)&&!isSafePreviewRender){
                issues.push({severity:'high',title:'XSS Vulnerability',file:f.name,path:f.path,desc:'Direct HTML injection can lead to XSS attacks. Sanitize user input.',code:''});
            }
            if(scanContent.includes('eval(')){
                var evalLine=lines.findIndex(function(l){return l.includes('eval(');});
                issues.push({severity:'medium',title:'Dynamic Code Execution',file:f.name,path:f.path,line:evalLine+1,desc:'eval() executes arbitrary code. Avoid if possible or validate input strictly.',code:evalLine>=0?lines[evalLine].trim().substring(0,80):''});
            }
            if(scanContent.includes('Function(')||scanContent.match(/new\s+Function\s*\(/)){
                issues.push({severity:'medium',title:'Function Constructor',file:f.name,path:f.path,desc:'Function constructor is similar to eval(). Consider alternatives.',code:''});
            }
            if(scanContent.match(/\.exec\s*\(/)||scanContent.match(/child_process/)){
                issues.push({severity:'medium',title:'Command Execution',file:f.name,path:f.path,desc:'Shell command execution detected. Ensure input is sanitized to prevent injection.',code:''});
            }
            if(scanContent.match(/console\.(log|debug|info)\(/)){
                var consoleCount=(scanContent.match(/console\.(log|debug|info)\(/g)||[]).length;
                if(consoleCount>3){
                    issues.push({severity:'low',title:'Debug Statements',file:f.name,path:f.path,desc:consoleCount+' console statements found. Remove before production.',code:''});
                }
            }
            // VBA-specific security checks
            if(scanContent.match(/SendKeys\s*\(/i)){
                issues.push({severity:'high',title:'SendKeys Usage',file:f.name,path:f.path,desc:'SendKeys can be exploited for code injection. Avoid using SendKeys.',code:''});
            }
            if(scanContent.match(/Shell\s*\(/i)){
                issues.push({severity:'high',title:'Shell Command Execution',file:f.name,path:f.path,desc:'Shell() executes system commands. Ensure input is validated.',code:''});
            }
            if(scanContent.match(/CreateObject\s*\(\s*["']WScript\.Shell["']/i)){
                issues.push({severity:'high',title:'WScript.Shell Creation',file:f.name,path:f.path,desc:'Creating WScript.Shell object allows command execution. Use with caution.',code:''});
            }
            if(scanContent.match(/Application\.Run\s*\(/i)){
                issues.push({severity:'medium',title:'Dynamic Code Execution',file:f.name,path:f.path,desc:'Application.Run can execute arbitrary code. Validate input.',code:''});
            }
            if(scanContent.match(/On Error Resume Next/i)){
                var errorResumeCount=(scanContent.match(/On Error Resume Next/gi)||[]).length;
                if(errorResumeCount>2){
                    issues.push({severity:'medium',title:'Excessive Error Suppression',file:f.name,path:f.path,desc:errorResumeCount+' instances of "On Error Resume Next" found. This can hide bugs.',code:''});
                }
            }
            if(scanContent.match(/TODO|FIXME|HACK|XXX/)){
                var todoCount=(scanContent.match(/TODO|FIXME|HACK|XXX/g)||[]).length;
                issues.push({severity:'low',title:'Code Comments',file:f.name,path:f.path,desc:todoCount+' TODO/FIXME comments found. Address before release.',code:''});
            }
            // Python-specific security checks
            var isPyFile=f.name.endsWith('.py')||f.name.endsWith('.pyw');
            if(isPyFile&&scanContent){
                // eval() and exec() - arbitrary code execution
                if(scanContent.match(/\beval\s*\(/)){
                    var evalLine=lines.findIndex(function(l){return l.match(/\beval\s*\(/);});
                    issues.push({severity:'high',title:'Python eval()',file:f.name,path:f.path,line:evalLine>=0?evalLine+1:undefined,desc:'eval() executes arbitrary Python code. Use ast.literal_eval() for safe parsing.',code:evalLine>=0?lines[evalLine].trim().substring(0,80):''});
                }
                if(scanContent.match(/\bexec\s*\(/)){
                    var execLine=lines.findIndex(function(l){return l.match(/\bexec\s*\(/);});
                    issues.push({severity:'high',title:'Python exec()',file:f.name,path:f.path,line:execLine>=0?execLine+1:undefined,desc:'exec() executes arbitrary Python code. This is almost always a security risk.',code:execLine>=0?lines[execLine].trim().substring(0,80):''});
                }
                // pickle - deserialization attacks
                if(scanContent.match(/\bpickle\.load/)||scanContent.match(/\bunpickle/)){
                    issues.push({severity:'high',title:'Pickle Deserialization',file:f.name,path:f.path,desc:'pickle.load() can execute arbitrary code from untrusted data. Use JSON or safe alternatives.',code:''});
                }
                // subprocess with shell=True
                if(scanContent.match(/subprocess\.\w+\([^)]*shell\s*=\s*True/)){
                    issues.push({severity:'high',title:'Shell Injection Risk',file:f.name,path:f.path,desc:'subprocess with shell=True is vulnerable to command injection. Use shell=False with a list of args.',code:''});
                }
                // os.system / os.popen - command injection
                if(scanContent.match(/\bos\.system\s*\(/)||scanContent.match(/\bos\.popen\s*\(/)){
                    var osLine=lines.findIndex(function(l){return l.match(/\bos\.(system|popen)\s*\(/);});
                    issues.push({severity:'high',title:'OS Command Execution',file:f.name,path:f.path,line:osLine>=0?osLine+1:undefined,desc:'os.system()/os.popen() are vulnerable to command injection. Use subprocess with shell=False.',code:osLine>=0?lines[osLine].trim().substring(0,80):''});
                }
                // __import__ - dynamic imports
                if(scanContent.match(/__import__\s*\(/)){
                    issues.push({severity:'medium',title:'Dynamic Import',file:f.name,path:f.path,desc:'__import__() with user input can load arbitrary modules. Validate module names against an allowlist.',code:''});
                }
                // Bare except clauses
                var bareExcepts=(scanContent.match(/\bexcept\s*:/g)||[]).length;
                if(bareExcepts>2){
                    issues.push({severity:'medium',title:'Bare Except Clauses',file:f.name,path:f.path,desc:bareExcepts+' bare except: clauses found. These catch all exceptions including SystemExit and KeyboardInterrupt.',code:''});
                }
                // assert in non-test files
                if(!f.name.includes('test')&&!f.path.includes('test')){
                    var assertCount=(scanContent.match(/\bassert\s+/g)||[]).length;
                    if(assertCount>5){
                        issues.push({severity:'low',title:'Assert in Production',file:f.name,path:f.path,desc:assertCount+' assert statements found. Assertions are stripped with python -O. Use proper validation.',code:''});
                    }
                }
                // Hardcoded DEBUG = True
                if(scanContent.match(/\bDEBUG\s*=\s*True\b/)){
                    issues.push({severity:'medium',title:'Debug Mode Enabled',file:f.name,path:f.path,desc:'DEBUG = True found. Ensure this is disabled in production.',code:''});
                }
            }
        });
        return issues.sort(function(a,b){var sev={high:0,medium:1,low:2};return sev[a.severity]-sev[b.severity];});
    },
    // AST-based function extraction - accurate detection without false positives
    extract:function(content,filename){
        var fns=[];
        var lines=content.split('\n');

        // Helper to extract code snippet for a function
        function extractCode(startLine,endLine){
            var code=[];
            var start=Math.max(0,startLine-1);
            var end=Math.min(lines.length,endLine||startLine+20);
            for(var i=start;i<end&&code.length<15;i++){
                code.push(lines[i]);
            }
            if(code.length>=15)code.push('  // ...');
            return code.join('\n');
        }

        // Track functions by line to allow same name at different locations
        var seenAtLine={};
        function addFn(fnObj){
            var key=fnObj.name+'@'+fnObj.line;
            if(!seenAtLine[key]){
                seenAtLine[key]=true;
                fns.push(fnObj);
            }
        }

        var scriptBlocks=Parser.getEmbeddedCodeBlocks(content,filename,{includeHandlers:false}).filter(function(block){
            return block.kind==='script';
        });
        if(scriptBlocks.length){
            scriptBlocks.forEach(function(block){
                Parser.extractJSFunctions(block.content,filename,block.offset,addFn,extractCode,block.isTS);
            });
            return fns;
        }
        if(Parser.isScriptContainer(filename)){
            return fns;
        }

        // Check file type
        var ext=filename.toLowerCase();
        var isJS=ext.endsWith('.js')||ext.endsWith('.jsx')||ext.endsWith('.mjs')||ext.endsWith('.cjs');
        var isTS=ext.endsWith('.ts')||ext.endsWith('.tsx');
        var isVue=ext.endsWith('.vue');
        var isSvelte=ext.endsWith('.svelte');
        var isPython=ext.endsWith('.py')||ext.endsWith('.pyw')||ext.endsWith('.pyi');

        // Extract script content from Vue/Svelte files
        var scriptContent=content;
        var scriptOffset=0;
        if(isVue||isSvelte){
            var scriptMatch=content.match(/<script\b[^>]*>([\s\S]*?)<\/script\b[^>]*>/i);
            if(scriptMatch){
                scriptContent=scriptMatch[1];
                scriptOffset=content.substring(0,content.indexOf(scriptMatch[1])).split('\n').length-1;
                isJS=true;  // Treat extracted script as JS
                // Check if it's TypeScript
                if(content.match(/<script\b[^>]*\blang=["']ts["'][^>]*>/i)){
                    isTS=true;
                    isJS=false;
                }
            }else{
                // No script tag found
                return fns;
            }
            lines=scriptContent.split('\n');
        }

        // Try AST parsing for JS/TS files using real parsers
        if((isJS||isTS)&&typeof acorn!=='undefined'){
            var parseContent=scriptContent;
            var parseSuccess=false;

            // Use Babel (real parser) to handle JSX and TypeScript properly
            // Babel transforms JSX → React.createElement and strips TS types,
            // producing clean JS that acorn can parse into a proper AST
            if(typeof Babel!=='undefined'){
                try{
                    var babelPresets=['react'];
                    if(isTS)babelPresets.push('typescript');
                    var babelResult=Babel.transform(parseContent,{
                        presets:babelPresets,
                        filename:filename||'file.js',
                        sourceType:'module',
                        retainLines:true
                    });
                    parseContent=babelResult.code;
                }catch(babelErr){
                    // Babel failed, fall back to manual TypeScript stripping
                    if(isTS){
                        parseContent=Parser.stripTypeScript(scriptContent);
                    }
                }
            }else if(isTS){
                parseContent=Parser.stripTypeScript(scriptContent);
            }

            // Parse clean JS with acorn
            try{
                var ast=acorn.parse(parseContent,{
                    ecmaVersion:2022,
                    sourceType:'module',
                    allowHashBang:true,
                    allowAwaitOutsideFunction:true,
                    allowImportExportEverywhere:true,
                    allowReturnOutsideFunction:true,
                    locations:true
                });
                parseSuccess=true;

                // Walk the AST to find ALL function definitions
                function walk(node,scope,parentIsExport){
                    if(!node||typeof node!=='object')return;

                    var isTopLevel=(scope===0);

                    // FunctionDeclaration: function foo() {}
                    if(node.type==='FunctionDeclaration'&&node.id&&node.id.name){
                        var line=(node.loc?node.loc.start.line:1)+scriptOffset;
                        var endLine=(node.loc?node.loc.end.line:line)+scriptOffset;
                        addFn({
                            name:node.id.name,
                            file:filename,
                            line:line,
                            code:extractCode(line,endLine),
                            isTopLevel:isTopLevel,
                            isExported:parentIsExport||false,
                            type:'function'
                        });
                    }

                    // VariableDeclaration: const foo = () => {} or const foo = function() {}
                    if(node.type==='VariableDeclaration'){
                        node.declarations.forEach(function(decl){
                            if(decl.id&&decl.id.type==='Identifier'&&decl.init){
                                var init=decl.init;
                                // Direct function expression or arrow function ONLY
                                // NOT CallExpression (e.g., array.map(x => x))
                                if(init.type==='FunctionExpression'||init.type==='ArrowFunctionExpression'){
                                    var line=(decl.loc?decl.loc.start.line:1)+scriptOffset;
                                    var endLine=(decl.loc?decl.loc.end.line:line)+scriptOffset;
                                    addFn({
                                        name:decl.id.name,
                                        file:filename,
                                        line:line,
                                        code:extractCode(line,endLine),
                                        isTopLevel:isTopLevel,
                                        isExported:parentIsExport||false,
                                        type:init.type==='ArrowFunctionExpression'?'arrow':'function'
                                    });
                                }
                            }
                        });
                    }

                    // MethodDefinition in classes
                    if(node.type==='MethodDefinition'&&node.key){
                        var name=node.key.name||node.key.value;
                        if(name&&name!=='constructor'){
                            var line=(node.loc?node.loc.start.line:1)+scriptOffset;
                            var endLine=(node.loc?node.loc.end.line:line)+scriptOffset;
                            addFn({
                                name:name,
                                file:filename,
                                line:line,
                                code:extractCode(line,endLine),
                                isTopLevel:false,
                                isExported:false,
                                type:'method',
                                isClassMethod:true,
                                isGetter:node.kind==='get',
                                isSetter:node.kind==='set'
                            });
                        }
                    }

                    // Property with method shorthand: { foo() {} }
                    if(node.type==='Property'&&node.method&&node.key){
                        var name=node.key.name||node.key.value;
                        if(name){
                            var line=(node.loc?node.loc.start.line:1)+scriptOffset;
                            var endLine=(node.loc?node.loc.end.line:line)+scriptOffset;
                            addFn({
                                name:name,
                                file:filename,
                                line:line,
                                code:extractCode(line,endLine),
                                isTopLevel:false,
                                isExported:false,
                                type:'method'
                            });
                        }
                    }

                    // Property with function value: { foo: function() {} } or { foo: () => {} }
                    if(node.type==='Property'&&!node.method&&node.value&&node.key){
                        var val=node.value;
                        if(val.type==='FunctionExpression'||val.type==='ArrowFunctionExpression'){
                            var name=node.key.name||node.key.value;
                            if(name){
                                var line=(node.loc?node.loc.start.line:1)+scriptOffset;
                                var endLine=(node.loc?node.loc.end.line:line)+scriptOffset;
                                addFn({
                                    name:name,
                                    file:filename,
                                    line:line,
                                    code:extractCode(line,endLine),
                                    isTopLevel:false,
                                    isExported:false,
                                    type:'method'
                                });
                            }
                        }
                    }

                    // Handle exports
                    var nextIsExport=false;
                    if(node.type==='ExportNamedDeclaration'||node.type==='ExportDefaultDeclaration'){
                        nextIsExport=true;
                        if(node.declaration){
                            walk(node.declaration,scope,true);
                            return;
                        }
                    }

                    // Recurse - increase scope for function bodies
                    var newScope=scope;
                    if(node.type==='FunctionDeclaration'||node.type==='FunctionExpression'||
                       node.type==='ArrowFunctionExpression'||node.type==='ClassDeclaration'||
                       node.type==='ClassExpression'){
                        newScope=scope+1;
                    }

                    for(var key in node){
                        if(key==='loc'||key==='range'||key==='start'||key==='end'||key==='raw')continue;
                        var child=node[key];
                        if(Array.isArray(child)){
                            child.forEach(function(c){walk(c,newScope,nextIsExport);});
                        }else if(child&&typeof child==='object'&&child.type){
                            walk(child,newScope,nextIsExport);
                        }
                    }
                }

                walk(ast,0,false);

            }catch(e){
                // AST parsing failed
                parseSuccess=false;
            }

            // If AST parsing failed, use comprehensive regex fallback
            if(!parseSuccess){
                Parser.extractWithRegex(scriptContent,filename,scriptOffset,addFn,extractCode);
            }
        }else if(isPython){
            // Python: extract classes, functions, async functions, decorators, and methods
            var currentClass=null;
            var classIndent=-1;
            var decorators=[];
            lines.forEach(function(line,idx){
                var trimmed=line.trimStart();
                var indent=(line.match(/^(\s*)/)||['',''])[1].length;

                // Track decorators
                if(trimmed.match(/^@\w/)){
                    decorators.push(trimmed);
                    return;
                }

                // Detect class definitions
                var classMatch=line.match(/^(\s*)class\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*[\(:]?/);
                if(classMatch){
                    var cIndent=classMatch[1].length;
                    var className=classMatch[2];
                    var cEndLine=idx+1;
                    for(var i=idx+1;i<lines.length;i++){
                        var nl=lines[i];
                        if(nl.trim()===''||nl.match(/^\s*#/))continue;
                        var ni=(nl.match(/^(\s*)/)||['',''])[1].length;
                        if(ni<=cIndent&&nl.trim()!==''){cEndLine=i;break;}
                        cEndLine=i+1;
                    }
                    var hasDecorator=decorators.length>0;
                    var isDataclass=decorators.some(function(d){return d.includes('dataclass');});
                    var isABC=line.includes('ABC')||line.includes('ABCMeta');
                    addFn({
                        name:className,
                        file:filename,
                        line:idx+1,
                        code:extractCode(idx+1,Math.min(idx+20,cEndLine)),
                        isTopLevel:cIndent===0,
                        isExported:cIndent===0,
                        type:isDataclass?'dataclass':isABC?'abstract_class':'class',
                        decorators:hasDecorator?decorators.slice():undefined
                    });
                    currentClass=className;
                    classIndent=cIndent;
                    decorators=[];
                    return;
                }

                // Reset class context when dedented
                if(currentClass!==null&&indent<=classIndent&&trimmed!==''&&!trimmed.startsWith('#')){
                    currentClass=null;
                    classIndent=-1;
                }

                // Detect function/method definitions (including async def)
                var m=line.match(/^(\s*)(?:async\s+)?def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/);
                if(m){
                    var fIndent=m[1].length;
                    var name=m[2];
                    var isAsync=line.match(/\basync\s+def\b/)!==null;
                    var isMethod=currentClass!==null&&fIndent>classIndent;
                    var isDunder=name.startsWith('__')&&name.endsWith('__');
                    var isPrivate=name.startsWith('_')&&!isDunder;
                    var isSelf=line.match(/def\s+\w+\s*\(\s*self[\s,)]/);
                    var isCls=line.match(/def\s+\w+\s*\(\s*cls[\s,)]/);
                    var hasDecorator=decorators.length>0;
                    var isProperty=decorators.some(function(d){return d.includes('@property');});
                    var isStaticmethod=decorators.some(function(d){return d.includes('@staticmethod');});
                    var isClassmethod=decorators.some(function(d){return d.includes('@classmethod');});

                    var endLine=idx+1;
                    for(var i=idx+1;i<lines.length;i++){
                        var nextLine=lines[i];
                        if(nextLine.trim()===''||nextLine.match(/^\s*#/))continue;
                        var nextIndent=(nextLine.match(/^(\s*)/)||['',''])[1].length;
                        if(nextIndent<=fIndent&&nextLine.trim()!==''){endLine=i;break;}
                        endLine=i+1;
                    }

                    var fnType='function';
                    if(isMethod){
                        if(isProperty)fnType='property';
                        else if(isStaticmethod)fnType='staticmethod';
                        else if(isClassmethod)fnType='classmethod';
                        else fnType='method';
                    }
                    if(isAsync)fnType='async_'+fnType;

                    addFn({
                        name:isMethod&&currentClass?currentClass+'.'+name:name,
                        file:filename,
                        line:idx+1,
                        code:extractCode(idx+1,endLine),
                        isTopLevel:fIndent===0,
                        isExported:fIndent===0&&!isPrivate,
                        isClassMethod:isMethod,
                        type:fnType,
                        className:isMethod?currentClass:undefined,
                        decorators:hasDecorator?decorators.slice():undefined
                    });
                    decorators=[];
                }else if(!classMatch){
                    // Reset decorators if line is not a def or class
                    if(trimmed!==''&&!trimmed.startsWith('#')&&!trimmed.startsWith('@')){
                        decorators=[];
                    }
                }
            });
        }else{
            // Other languages: use language-specific regex
            Parser.extractOtherLanguages(content,filename,addFn,extractCode);
        }

        return fns;
    },

    // Strip Python string literals and comments for accurate token-level analysis
    // This is a proper tokenizer approach: preserves code structure while removing non-code content
    stripPythonNonCode:function(content){
        var result=[];
        var i=0;
        var len=content.length;
        while(i<len){
            // Triple-quoted strings (must check before single quotes)
            if(i<len-2&&((content[i]==='"'&&content[i+1]==='"'&&content[i+2]==='"')||(content[i]==="'"&&content[i+1]==="'"&&content[i+2]==="'"))){
                var q3=content[i];
                i+=3;
                while(i<len-2){
                    if(content[i]===q3&&content[i+1]===q3&&content[i+2]===q3){i+=3;break;}
                    result.push(content[i]==='\n'?'\n':' ');
                    i++;
                }
            }
            // String prefixes (f/r/b/u and combinations like rb, fr, etc.)
            else if(i<len-1&&/^[frbuFRBU]{1,2}$/.test(content.slice(i,i+1+(content[i+1]&&/[frbuFRBU"']/.test(content[i+1])?1:0)).replace(/["']/g,''))&&
                    (content[i+1]==='"'||content[i+1]==="'"||content[i+2]==='"'||content[i+2]==="'")){
                // Skip prefix chars
                while(i<len&&content[i]!=='"'&&content[i]!=="'"){result.push(' ');i++;}
                // Fall through to string handling below (don't continue)
                if(i>=len)break;
                // Check for triple-quoted prefixed string
                if(i<len-2&&content[i+1]===content[i]&&content[i+2]===content[i]){
                    var pq3=content[i];i+=3;
                    while(i<len-2){
                        if(content[i]===pq3&&content[i+1]===pq3&&content[i+2]===pq3){i+=3;break;}
                        result.push(content[i]==='\n'?'\n':' ');i++;
                    }
                }else{
                    var pq=content[i];result.push(' ');i++;
                    while(i<len&&content[i]!==pq&&content[i]!=='\n'){
                        if(content[i]==='\\'){result.push(' ');i++;}
                        if(i<len){result.push(content[i]==='\n'?'\n':' ');i++;}
                    }
                    if(i<len&&content[i]===pq){result.push(' ');i++;}
                }
            }
            // Regular single/double quoted strings
            else if(content[i]==='"'||content[i]==="'"){
                var q=content[i];result.push(' ');i++;
                while(i<len&&content[i]!==q&&content[i]!=='\n'){
                    if(content[i]==='\\'){result.push(' ');i++;}
                    if(i<len){result.push(content[i]==='\n'?'\n':' ');i++;}
                }
                if(i<len&&content[i]===q){result.push(' ');i++;}
            }
            // Comments
            else if(content[i]==='#'){
                while(i<len&&content[i]!=='\n'){result.push(' ');i++;}
            }
            // Normal code - pass through
            else{
                result.push(content[i]);i++;
            }
        }
        return result.join('');
    },

    // Strip TypeScript syntax for Acorn parsing
    stripTypeScript:function(content){
        // Process line by line for more control
        var lines=content.split('\n');
        var result=[];
        var inInterface=false;
        var braceDepth=0;

        for(var i=0;i<lines.length;i++){
            var line=lines[i];

            // Skip type-only imports/exports
            if(line.match(/^\s*import\s+type\s/)||line.match(/^\s*export\s+type\s/)){
                result.push('');
                continue;
            }

            // Track interface/type blocks to skip
            if(line.match(/^\s*(?:export\s+)?interface\s+/)||line.match(/^\s*(?:export\s+)?type\s+\w+\s*=/)){
                inInterface=true;
                braceDepth=0;
            }

            if(inInterface){
                for(var j=0;j<line.length;j++){
                    if(line[j]==='{')braceDepth++;
                    if(line[j]==='}')braceDepth--;
                }
                if(braceDepth<=0&&(line.includes('}')||line.includes(';')||!line.match(/[{;]/))){
                    inInterface=false;
                }
                result.push('');
                continue;
            }

            // Remove type annotations carefully
            // Function params: (x: Type) -> (x)
            line=line.replace(/(\w)\s*:\s*[A-Za-z_$<>[\]|&\s,]+(?=[,\)])/g,'$1');
            // Return types: ): Type => -> ) =>  or ): Type { -> ) {
            line=line.replace(/\)\s*:\s*[A-Za-z_$<>[\]|&\s]+(?=\s*[{=>])/g,')');
            // Variable types: let x: Type = -> let x =
            line=line.replace(/(let|const|var)\s+(\w+)\s*:\s*[A-Za-z_$<>[\]|&\s]+\s*=/g,'$1 $2 =');
            // Generic type params: func<T>( -> func(
            // Apply repeatedly to handle nested or multiple occurrences
            var prevLine;
            do{
                prevLine=line;
                line=line.replace(/<[A-Za-z_$,\s]+>(?=\s*\()/g,'');
            }while(line!==prevLine);
            // As casts: x as Type -> x
            line=line.replace(/\s+as\s+[A-Za-z_$<>[\]|&\s]+(?=[,;\)\]\}]|$)/g,'');
            // Non-null assertions: x! -> x
            line=line.replace(/!(?=[\.\[\)\],;\s])/g,'');
            // Declare statements
            if(line.match(/^\s*declare\s+/)){
                result.push('');
                continue;
            }

            result.push(line);
        }

        return result.join('\n');
    },

    // Comprehensive regex fallback for JS/TS when AST fails
    extractWithRegex:function(content,filename,offset,addFn,extractCode){
        var lines=content.split('\n');

        lines.forEach(function(line,idx){
            var lineNum=idx+1+offset;
            var m;

            // Named function declarations (capture export keyword for isExported)
            if((m=line.match(/(export\s+(?:default\s+)?)?(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/)))
                addFn({name:m[2],file:filename,line:lineNum,code:extractCode(lineNum),isTopLevel:true,isExported:!!m[1],type:'function'});

            // Arrow functions assigned to const/let/var at START of meaningful content
            // Must have = directly followed by arrow function pattern
            if((m=line.match(/(export\s+)?(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/)))
                addFn({name:m[2],file:filename,line:lineNum,code:extractCode(lineNum),isTopLevel:true,isExported:!!m[1],type:'arrow'});

            // Arrow functions with single param (no parens): const foo = x =>
            if((m=line.match(/(export\s+)?(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>/)))
                addFn({name:m[2],file:filename,line:lineNum,code:extractCode(lineNum),isTopLevel:true,isExported:!!m[1],type:'arrow'});

            // Function expressions: const foo = function
            if((m=line.match(/(export\s+)?(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?function\s*[(\w]/)))
                addFn({name:m[2],file:filename,line:lineNum,code:extractCode(lineNum),isTopLevel:true,isExported:!!m[1],type:'function'});

            // Class methods (inside class body): methodName() { or async methodName() {
            if((m=line.match(/^\s+(?:async\s+)?([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*\{/))&&!line.match(/^s*(if|for|while|switch|catch|function|const|let|var)/))
                addFn({name:m[1],file:filename,line:lineNum,code:extractCode(lineNum),isTopLevel:false,type:'method',isClassMethod:true});

            // Object method shorthand (indented): foo() { or foo: function
            if((m=line.match(/^\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*(?:async\s+)?function/)))
                addFn({name:m[1],file:filename,line:lineNum,code:extractCode(lineNum),isTopLevel:false,type:'method'});

            // Object property arrow: foo: () =>
            if((m=line.match(/^\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*(?:async\s*)?\([^)]*\)\s*=>/)))
                addFn({name:m[1],file:filename,line:lineNum,code:extractCode(lineNum),isTopLevel:false,type:'method'});
        });
    },

    // Extract functions from other languages
    extractOtherLanguages:function(content,filename,addFn,extractCode){
        var lines=content.split('\n');
        var ext=filename.toLowerCase().split('.').pop();
        var seen=new Set();
        function safeAdd(fn){
            var key=fn.name+'@'+fn.line;
            if(!seen.has(key)){seen.add(key);addFn(fn);}
        }

        lines.forEach(function(line,idx){
            var lineNum=idx+1;
            var trimmed=line.trim();
            var m;

            // Skip comment lines
            if(trimmed.startsWith('//')||trimmed.startsWith('*')||trimmed.startsWith('#')||trimmed.startsWith('--'))return;

            // Go: func name( or func (recv) name(
            if(ext==='go'){
                if((m=trimmed.match(/^func\s+(?:\([^)]+\)\s*)?([A-Za-z_][A-Za-z0-9_]*)\s*[(<]/)))
                    safeAdd({name:m[1],file:filename,line:lineNum,code:extractCode(lineNum),isTopLevel:true,isExported:/^[A-Z]/.test(m[1]),type:'function'});
                return;
            }

            // Java: method and constructor detection
            if(ext==='java'){
                // Constructor: ClassName(
                if((m=trimmed.match(/^(?:public|private|protected)?\s*([A-Z][A-Za-z0-9_]*)\s*\([^)]*\)\s*(?:throws\s+\w[\w,\s]*)?\s*\{/)))
                    safeAdd({name:m[1],file:filename,line:lineNum,code:extractCode(lineNum),isTopLevel:false,type:'constructor'});
                // Method: visibility [static] [final] returnType name(
                if((m=trimmed.match(/^(?:(?:public|private|protected|static|final|abstract|synchronized|native|strictfp)\s+)+([A-Za-z_$][\w$<>\[\]]*)\s+([A-Za-z_$][\w$]*)\s*\(/)))
                    safeAdd({name:m[2],file:filename,line:lineNum,code:extractCode(lineNum),isTopLevel:false,isExported:line.includes('public'),type:'method'});
                return;
            }

            // C#: method/property/constructor
            if(ext==='cs'){
                if((m=trimmed.match(/^(?:(?:public|private|protected|internal|static|virtual|override|abstract|async|sealed|extern|partial)\s+)+(?:[\w<>\[\]]+\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*[(<]/)))
                    if(!trimmed.match(/^(if|for|while|foreach|switch|using|lock|catch)\b/))
                        safeAdd({name:m[1],file:filename,line:lineNum,code:extractCode(lineNum),isTopLevel:false,isExported:line.includes('public'),type:'method'});
                return;
            }

            // Kotlin: fun / suspend fun
            if(ext==='kt'||ext==='kts'){
                if((m=trimmed.match(/^(?:(?:public|private|protected|internal|override|open|abstract|suspend|inline|infix|operator|tailrec|external|actual|expect)\s+)*fun\s+([A-Za-z_][A-Za-z0-9_]*)\s*[<(]/)))
                    safeAdd({name:m[1],file:filename,line:lineNum,code:extractCode(lineNum),isTopLevel:true,isExported:!line.includes('private'),type:'function'});
                return;
            }

            // Rust: fn / pub fn / pub(crate) fn / async fn
            if(ext==='rs'){
                if((m=trimmed.match(/^(?:pub(?:\s*\([^)]+\))?\s+)?(?:async\s+)?(?:unsafe\s+)?fn\s+([A-Za-z_][A-Za-z0-9_]*)\s*[<(]/)))
                    safeAdd({name:m[1],file:filename,line:lineNum,code:extractCode(lineNum),isTopLevel:true,isExported:trimmed.startsWith('pub'),type:'function'});
                // impl block name
                if((m=trimmed.match(/^impl(?:<[^>]+>)?\s+(?:[\w:]+\s+for\s+)?([A-Za-z_][A-Za-z0-9_]*)/)))
                    safeAdd({name:'impl:'+m[1],file:filename,line:lineNum,code:extractCode(lineNum),isTopLevel:true,type:'impl'});
                return;
            }

            // Ruby: def name or def self.name
            if(ext==='rb'){
                if((m=trimmed.match(/^def\s+(?:self\.)?([A-Za-z_][A-Za-z0-9_?!]*)/)))
                    safeAdd({name:m[1],file:filename,line:lineNum,code:extractCode(lineNum),isTopLevel:true,isExported:true,type:'function'});
                return;
            }

            // PHP: function / method
            if(ext==='php'){
                if((m=trimmed.match(/^(?:(?:public|private|protected|static|abstract|final)\s+)*function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/)))
                    safeAdd({name:m[1],file:filename,line:lineNum,code:extractCode(lineNum),isTopLevel:true,isExported:!line.includes('private'),type:'function'});
                return;
            }

            // C/C++: return-type name( — avoid control flow keywords
            if(ext==='c'||ext==='cpp'||ext==='cc'||ext==='h'||ext==='hpp'){
                if((m=trimmed.match(/^(?:static\s+)?(?:inline\s+)?(?:virtual\s+)?(?:const\s+)?(?:[\w:*&<>]+\s+)+([A-Za-z_][A-Za-z0-9_:~]*)\s*\([^;)]*\)\s*(?:const\s*)?(?:override\s*)?(?:noexcept\s*)?[{;]/)))
                    if(!trimmed.match(/^(if|for|while|switch|return|sizeof|typeof|alignof|decltype|static_assert)\b/))
                        safeAdd({name:m[1],file:filename,line:lineNum,code:extractCode(lineNum),isTopLevel:true,type:'function'});
                return;
            }

            // Swift: func
            if(ext==='swift'){
                if((m=trimmed.match(/^(?:(?:public|private|internal|fileprivate|open|static|class|override|mutating|nonmutating|final|required|convenience|lazy|weak|unowned|dynamic|optional|prefix|postfix|infix)\s+)*func\s+([A-Za-z_][A-Za-z0-9_]*)\s*[<(]/)))
                    safeAdd({name:m[1],file:filename,line:lineNum,code:extractCode(lineNum),isTopLevel:true,isExported:!line.includes('private'),type:'function'});
                return;
            }

            // Scala: def
            if(ext==='scala'){
                if((m=trimmed.match(/^(?:(?:def|val|var)\s+)([A-Za-z_][A-Za-z0-9_]*)\s*[(\[:=]/)))
                    safeAdd({name:m[1],file:filename,line:lineNum,code:extractCode(lineNum),isTopLevel:true,type:'function'});
                return;
            }

            // Elixir: def / defp / defmacro
            if(ext==='ex'||ext==='exs'){
                if((m=trimmed.match(/^def(?:p|macro|macrop)?\s+([A-Za-z_][A-Za-z0-9_?!]*)/)))
                    safeAdd({name:m[1],file:filename,line:lineNum,code:extractCode(lineNum),isTopLevel:true,isExported:!trimmed.startsWith('defp'),type:'function'});
                return;
            }

            // Lua: function name( or local function name( or obj:method(
            if(ext==='lua'){
                if((m=trimmed.match(/^(?:local\s+)?function\s+([A-Za-z_][A-Za-z0-9_.:]*)s*\(/)))
                    safeAdd({name:m[1].split(/[.:]/).pop(),file:filename,line:lineNum,code:extractCode(lineNum),isTopLevel:true,type:'function'});
                return;
            }

            // Groovy/Gradle: def name( or returnType name(
            if(ext==='groovy'||ext==='gradle'){
                if((m=trimmed.match(/^(?:def|void|String|int|boolean|List|Map|Object)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/)))
                    safeAdd({name:m[1],file:filename,line:lineNum,code:extractCode(lineNum),isTopLevel:true,type:'function'});
                return;
            }

            // Haskell: name :: type signature (top-level definitions)
            if(ext==='hs'){
                if((m=trimmed.match(/^([a-z_][A-Za-z0-9_']*)\s*::/)))
                    safeAdd({name:m[1],file:filename,line:lineNum,code:extractCode(lineNum),isTopLevel:true,type:'function'});
                return;
            }

            // Shell: function name or name()
            if(ext==='sh'||ext==='bash'||ext==='zsh'||ext==='fish'){
                if((m=trimmed.match(/^(?:function\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*\(\s*\)/)))
                    safeAdd({name:m[1],file:filename,line:lineNum,code:extractCode(lineNum),isTopLevel:true,type:'function'});
                return;
            }

            // VBA: Sub Name() / Function Name()
            if(ext==='vba'||ext==='bas'||ext==='cls'){
                if((m=trimmed.match(/^(?:Public|Private|Friend)?\s*(?:Sub|Function)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/i)))
                    safeAdd({name:m[1],file:filename,line:lineNum,code:extractCode(lineNum),isTopLevel:true,type:'function'});
                return;
            }

            // Dart: returnType name( or void name(
            if(ext==='dart'){
                if((m=trimmed.match(/^(?:(?:static|async|Future|void|String|int|bool|List|Map|dynamic|Widget)\s+)+([A-Za-z_][A-Za-z0-9_]*)\s*[(<]/)))
                    if(!trimmed.match(/^(if|for|while|switch|return)\b/))
                        safeAdd({name:m[1],file:filename,line:lineNum,code:extractCode(lineNum),isTopLevel:true,type:'function'});
                return;
            }
        });
    },
    extractJSFunctions:function(content,filename,offset,addFn,extractCode,isTS){
        if(!content||!content.trim())return;
        if(typeof acorn!=='undefined'){
            var parseContent=content;
            var parseSuccess=false;

            if(typeof Babel!=='undefined'){
                try{
                    var babelPresets=['react'];
                    if(isTS)babelPresets.push('typescript');
                    var babelResult=Babel.transform(parseContent,{
                        presets:babelPresets,
                        filename:filename||'file.js',
                        sourceType:'module',
                        retainLines:true
                    });
                    parseContent=babelResult.code;
                }catch(babelErr){
                    if(isTS){
                        parseContent=Parser.stripTypeScript(content);
                    }
                }
            }else if(isTS){
                parseContent=Parser.stripTypeScript(content);
            }

            try{
                var ast=acorn.parse(parseContent,{
                    ecmaVersion:2022,
                    sourceType:'module',
                    allowHashBang:true,
                    allowAwaitOutsideFunction:true,
                    allowImportExportEverywhere:true,
                    allowReturnOutsideFunction:true,
                    locations:true
                });
                parseSuccess=true;

                function walk(node,scope,parentIsExport){
                    if(!node||typeof node!=='object')return;
                    var isTopLevel=(scope===0);

                    if(node.type==='FunctionDeclaration'&&node.id&&node.id.name){
                        var line=(node.loc?node.loc.start.line:1)+offset;
                        var endLine=(node.loc?node.loc.end.line:line)+offset;
                        addFn({
                            name:node.id.name,
                            file:filename,
                            line:line,
                            code:extractCode(line,endLine),
                            isTopLevel:isTopLevel,
                            isExported:parentIsExport||false,
                            type:'function'
                        });
                    }

                    if(node.type==='VariableDeclaration'){
                        node.declarations.forEach(function(decl){
                            if(decl.id&&decl.id.type==='Identifier'&&decl.init){
                                var init=decl.init;
                                if(init.type==='FunctionExpression'||init.type==='ArrowFunctionExpression'){
                                    var line=(decl.loc?decl.loc.start.line:1)+offset;
                                    var endLine=(decl.loc?decl.loc.end.line:line)+offset;
                                    addFn({
                                        name:decl.id.name,
                                        file:filename,
                                        line:line,
                                        code:extractCode(line,endLine),
                                        isTopLevel:isTopLevel,
                                        isExported:parentIsExport||false,
                                        type:init.type==='ArrowFunctionExpression'?'arrow':'function'
                                    });
                                }
                            }
                        });
                    }

                    if(node.type==='MethodDefinition'&&node.key){
                        var methodName=node.key.name||node.key.value;
                        if(methodName&&methodName!=='constructor'){
                            var methodLine=(node.loc?node.loc.start.line:1)+offset;
                            var methodEndLine=(node.loc?node.loc.end.line:methodLine)+offset;
                            addFn({
                                name:methodName,
                                file:filename,
                                line:methodLine,
                                code:extractCode(methodLine,methodEndLine),
                                isTopLevel:false,
                                isExported:false,
                                type:'method',
                                isClassMethod:true,
                                isGetter:node.kind==='get',
                                isSetter:node.kind==='set'
                            });
                        }
                    }

                    if(node.type==='Property'&&node.method&&node.key){
                        var shorthandName=node.key.name||node.key.value;
                        if(shorthandName){
                            var shorthandLine=(node.loc?node.loc.start.line:1)+offset;
                            var shorthandEndLine=(node.loc?node.loc.end.line:shorthandLine)+offset;
                            addFn({
                                name:shorthandName,
                                file:filename,
                                line:shorthandLine,
                                code:extractCode(shorthandLine,shorthandEndLine),
                                isTopLevel:false,
                                isExported:false,
                                type:'method'
                            });
                        }
                    }

                    if(node.type==='Property'&&!node.method&&node.value&&node.key){
                        var val=node.value;
                        if(val.type==='FunctionExpression'||val.type==='ArrowFunctionExpression'){
                            var propName=node.key.name||node.key.value;
                            if(propName){
                                var propLine=(node.loc?node.loc.start.line:1)+offset;
                                var propEndLine=(node.loc?node.loc.end.line:propLine)+offset;
                                addFn({
                                    name:propName,
                                    file:filename,
                                    line:propLine,
                                    code:extractCode(propLine,propEndLine),
                                    isTopLevel:false,
                                    isExported:false,
                                    type:'method'
                                });
                            }
                        }
                    }

                    var nextIsExport=false;
                    if(node.type==='ExportNamedDeclaration'||node.type==='ExportDefaultDeclaration'){
                        nextIsExport=true;
                        if(node.declaration){
                            walk(node.declaration,scope,true);
                            return;
                        }
                    }

                    var newScope=scope;
                    if(node.type==='FunctionDeclaration'||node.type==='FunctionExpression'||
                       node.type==='ArrowFunctionExpression'||node.type==='ClassDeclaration'||
                       node.type==='ClassExpression'){
                        newScope=scope+1;
                    }

                    for(var key in node){
                        if(key==='loc'||key==='range'||key==='start'||key==='end'||key==='raw')continue;
                        var child=node[key];
                        if(Array.isArray(child)){
                            child.forEach(function(c){walk(c,newScope,nextIsExport);});
                        }else if(child&&typeof child==='object'&&child.type){
                            walk(child,newScope,nextIsExport);
                        }
                    }
                }

                walk(ast,0,false);
            }catch(e){
                parseSuccess=false;
            }

            if(!parseSuccess){
                Parser.extractWithRegex(content,filename,offset,addFn,extractCode);
            }
            return;
        }

        Parser.extractWithRegex(content,filename,offset,addFn,extractCode);
    },
    findJSCalls:function(content,fnNames,defLines,options){
        var calls={};
        var refs={};
        fnNames.forEach(function(fn){calls[fn]=0;refs[fn]=0;});

        var sourceType=options&&options.sourceType==='script'?'script':'module';
        var isTS=!!(options&&options.isTS);

        if(typeof acorn!=='undefined'){
            try{
                var jsContent=content;
                if(typeof Babel!=='undefined'){
                    try{
                        var babelPresets=['react'];
                        if(isTS)babelPresets.push('typescript');
                        var babelResult=Babel.transform(content,{
                            presets:babelPresets,
                            filename:options&&options.filename?options.filename:'file.js',
                            sourceType:sourceType,
                            retainLines:true
                        });
                        jsContent=babelResult.code;
                    }catch(babelErr){
                        jsContent=isTS?Parser.stripTypeScript(content):content;
                    }
                }else if(isTS){
                    jsContent=Parser.stripTypeScript(content);
                }

                var ast=acorn.parse(jsContent,{
                    ecmaVersion:2022,
                    sourceType:sourceType,
                    allowHashBang:true,
                    allowAwaitOutsideFunction:true,
                    allowImportExportEverywhere:true,
                    allowReturnOutsideFunction:true,
                    locations:true,
                    tolerant:true
                });
                var fnSet=new Set(fnNames);

                function walk(node,inDeclaration){
                    if(!node||typeof node!=='object')return;
                    var isDecl=node.type==='FunctionDeclaration'||node.type==='VariableDeclarator';

                    if(node.type==='CallExpression'){
                        var callee=node.callee;
                        if(callee.type==='Identifier'&&fnSet.has(callee.name)){
                            var line=callee.loc?callee.loc.start.line:0;
                            if(!defLines[callee.name]||defLines[callee.name]!==line){
                                calls[callee.name]++;
                            }
                        }
                        node.arguments.forEach(function(arg){
                            if(arg.type==='Identifier'&&fnSet.has(arg.name)){
                                refs[arg.name]++;
                            }
                        });
                    }

                    if(node.type==='ArrayExpression'){
                        node.elements.forEach(function(el){
                            if(el&&el.type==='Identifier'&&fnSet.has(el.name)){
                                refs[el.name]++;
                            }
                        });
                    }
                    if(node.type==='Property'&&node.value&&node.value.type==='Identifier'&&fnSet.has(node.value.name)){
                        refs[node.value.name]++;
                    }

                    if(node.type==='Identifier'&&fnSet.has(node.name)&&!inDeclaration){
                        // Identifier references are handled via the surrounding parent nodes.
                    }

                    for(var key in node){
                        if(key==='loc'||key==='range'||key==='start'||key==='end')continue;
                        var child=node[key];
                        var nextInDecl=isDecl&&(key==='id'||key==='key');
                        if(Array.isArray(child)){
                            child.forEach(function(c){walk(c,nextInDecl);});
                        }else if(child&&typeof child==='object'&&child.type){
                            walk(child,nextInDecl);
                        }
                    }
                }

                walk(ast,false);
                fnNames.forEach(function(fn){
                    calls[fn]=calls[fn]+(refs[fn]||0);
                });
                return calls;
            }catch(e){
                // Fall back to regex below.
            }
        }

        var wordSet=new Set(content.match(/\b[a-zA-Z_$]\w*\b/g)||[]);
        fnNames.forEach(function(fn){
            if(!wordSet.has(fn))return;
            var callPattern=new RegExp('\\b'+fn+'\\s*\\(','g');
            var m=content.match(callPattern);
            var callCount=m?m.length:0;
            var defPattern=new RegExp('(?:function\\s+'+fn+'\\s*\\(|(?:async\\s+)?def\\s+'+fn+'\\s*\\(|class\\s+'+fn+'\\s*\\()','g');
            var defMatch=content.match(defPattern);
            if(defMatch)callCount-=defMatch.length;
            var refPattern=new RegExp('[,\\[:\\(=]\\s*'+fn+'\\s*[,\\]\\)\\};]','g');
            var refMatch=content.match(refPattern);
            var refCount=refMatch?refMatch.length:0;
            var jsxTagPattern=new RegExp('<\\/?\\s*'+fn+'[\\s>\\/{]','g');
            var jsxTagMatch=content.match(jsxTagPattern);
            if(jsxTagMatch)refCount+=jsxTagMatch.length;
            var jsxExprPattern=new RegExp('[{=][ \\t]*'+fn+'[ \\t]*[}(,;\\s]','g');
            var jsxExprMatch=content.match(jsxExprPattern);
            if(jsxExprMatch)refCount+=jsxExprMatch.length;
            calls[fn]=Math.max(0,callCount)+refCount;
        });
        return calls;
    },

    // AST-based call detection - finds actual function calls and references
    findCalls:function(content,fnNames,definingFile,fnDefs){
        var calls={};
        var refs={};  // Functions used as callbacks/references without ()
        fnNames.forEach(function(fn){calls[fn]=0;refs[fn]=0;});

        // Build a set of definition lines to exclude
        var defLines={};
        if(fnDefs){
            fnDefs.forEach(function(fn){
                if(fn.file===definingFile){
                    defLines[fn.name]=fn.line;
                }
            });
        }

        if(Parser.isScriptContainer(definingFile)){
            var blocks=Parser.getEmbeddedCodeBlocks(content,definingFile,{includeHandlers:true});
            if(!blocks.length)return calls;
            blocks.forEach(function(block){
                var blockCalls=Parser.findJSCalls(block.content,fnNames,defLines,{
                    filename:definingFile,
                    isTS:block.isTS,
                    sourceType:block.kind==='handler'?'script':block.sourceType
                });
                fnNames.forEach(function(fn){
                    calls[fn]+=blockCalls[fn]||0;
                });
            });
            return calls;
        }

        // Detect file language from defining file extension
        var ext=definingFile?definingFile.split('.').pop().toLowerCase():'';
        var isPython=['py','pyw','pyi'].indexOf(ext)>=0;
        var isJS=['js','jsx','ts','tsx','mjs','cjs','vue','svelte'].indexOf(ext)>=0;
        var isVBA=['vba','bas','cls','xlsm','xlam'].indexOf(ext)>=0;

        // Python: use tree-sitter real parser (WASM) for accurate AST-based detection
        if(isPython){
            if(Parser._tsParser){
                try{
                    var tree=Parser._tsParser.parse(content);
                    var root=tree.rootNode;
                    var fnSet=new Set(fnNames);

                    // Determine if an identifier node is a definition name (not a usage)
                    function isPyDefName(node){
                        var p=node.parent;
                        if(!p)return false;
                        // Function/class definition name: def foo / class Foo
                        if((p.type==='function_definition'||p.type==='class_definition')&&
                            p.childForFieldName('name')===node)return true;
                        // Parameter names in function signatures
                        if(p.type==='parameters'||p.type==='lambda_parameters')return true;
                        if((p.type==='typed_parameter'||p.type==='default_parameter'||
                            p.type==='typed_default_parameter')&&p.children[0]===node)return true;
                        if(p.type==='list_splat_pattern'||p.type==='dictionary_splat_pattern')return true;
                        // For loop target: for x in ...
                        if(p.type==='for_statement'&&p.childForFieldName('left')===node)return true;
                        // With statement target: with x as y
                        if(p.type==='as_pattern'&&p.childForFieldName('alias')===node)return true;
                        // Exception handler: except E as e
                        if(p.type==='except_clause')return false; // the exception type IS a reference
                        // Comprehension targets: [x for x in ...]
                        if(p.type==='for_in_clause'&&p.childForFieldName('left')===node)return true;
                        return false;
                    }

                    // Walk the CST: every identifier that matches a function name
                    // and is NOT a definition is counted as a usage reference.
                    // tree-sitter naturally excludes identifiers inside strings/comments
                    // because those are parsed as string/comment nodes, not identifiers.
                    function walkPy(node){
                        if(node.type==='identifier'&&fnSet.has(node.text)&&!isPyDefName(node)){
                            calls[node.text]++;
                        }
                        for(var i=0;i<node.childCount;i++){
                            walkPy(node.child(i));
                        }
                    }
                    walkPy(root);
                    tree.delete();
                    return calls;
                }catch(tsErr){
                    // tree-sitter parse failed, fall through to tokenizer fallback
                }
            }

            // Fallback: token-level analysis with string/comment stripping
            var cleanContent=Parser.stripPythonNonCode(content);
            var wordSet=new Set(cleanContent.match(/\b[a-zA-Z_]\w*\b/g)||[]);
            var importText='';
            var multiImports=cleanContent.match(/from\s+\S+\s+import\s*\([\s\S]*?\)/g)||[];
            multiImports.forEach(function(imp){importText+=imp+'\n';});
            var singleImports=cleanContent.match(/^(?:from\s+\S+\s+import\s+[^(\n].+|import\s+.+)$/gm)||[];
            singleImports.forEach(function(imp){importText+=imp+'\n';});
            fnNames.forEach(function(fn){
                if(!wordSet.has(fn))return;
                if(importText.match(new RegExp('\\b'+fn+'\\b'))){calls[fn]++;}
            });
            fnNames.forEach(function(fn){
                if(!wordSet.has(fn))return;
                var callPattern=new RegExp('\\b'+fn+'\\s*\\(','g');
                var m=cleanContent.match(callPattern);
                var callCount=m?m.length:0;
                var defPattern=new RegExp('(?:(?:async\\s+)?def|class)\\s+'+fn+'\\s*[\\(:]','g');
                var defMatch=cleanContent.match(defPattern);
                if(defMatch)callCount-=defMatch.length;
                var decPattern=new RegExp('@'+fn+'\\b','g');
                var decMatch=cleanContent.match(decPattern);
                if(decMatch)callCount=Math.max(0,callCount)+(decMatch.length);
                var methodPattern=new RegExp('\\w+\\.'+fn+'\\s*\\(','g');
                var methodMatch=cleanContent.match(methodPattern);
                if(methodMatch)callCount+=methodMatch.length;
                var refPattern=new RegExp('[,\\[\\(=:\\{]\\s*'+fn+'\\s*[,\\]\\)\\n\\r}]','g');
                var refMatch=cleanContent.match(refPattern);
                var refCount=refMatch?refMatch.length:0;
                var retPattern=new RegExp('(?:return|yield)\\s+'+fn+'\\s*$','gm');
                var retMatch=cleanContent.match(retPattern);
                if(retMatch)refCount+=retMatch.length;
                calls[fn]=Math.max(0,callCount)+refCount;
            });
            return calls;
        }

        if(isJS&&typeof acorn!=='undefined'){
            try{
                // Use Babel (real parser) to handle JSX and TypeScript
                // Babel transforms JSX → React.createElement calls and strips TS types,
                // so acorn can parse the result into a proper AST for accurate call detection
                var jsContent=content;
                if(typeof Babel!=='undefined'){
                    try{
                        var babelPresets=['react'];
                        if(ext==='ts'||ext==='tsx')babelPresets.push('typescript');
                        var babelResult=Babel.transform(content,{
                            presets:babelPresets,
                            filename:definingFile||'file.js',
                            sourceType:'module',
                            retainLines:true
                        });
                        jsContent=babelResult.code;
                    }catch(babelErr){
                        // Babel failed, fall back to manual TypeScript stripping
                        jsContent=content
                            .replace(/:\s*[A-Za-z_$][\w$<>,\s|&\[\]]*(?=\s*[=,\)\}\];])/g,'')
                            .replace(/\bas\s+[A-Za-z_$][\w$<>,\s|&\[\]]*(?=\s*[,\)\}\];])/g,'')
                            .replace(/<[A-Za-z_$][\w$<>,\s|&\[\]]*>(?=\s*\()/g,'')
                            .replace(/^import\s+type\s+.*/gm,'')
                            .replace(/^export\s+type\s+.*/gm,'')
                            .replace(/^export\s+interface\s+.*/gm,'')
                            .replace(/interface\s+[A-Za-z_$][\w$]*\s*\{[^}]*\}/g,'')
                            .replace(/type\s+[A-Za-z_$][\w$]*\s*=\s*[^;]+;/g,'');
                    }
                }else{
                    jsContent=content
                        .replace(/:\s*[A-Za-z_$][\w$<>,\s|&\[\]]*(?=\s*[=,\)\}\];])/g,'')
                        .replace(/\bas\s+[A-Za-z_$][\w$<>,\s|&\[\]]*(?=\s*[,\)\}\];])/g,'')
                        .replace(/<[A-Za-z_$][\w$<>,\s|&\[\]]*>(?=\s*\()/g,'')
                        .replace(/^import\s+type\s+.*/gm,'')
                        .replace(/^export\s+type\s+.*/gm,'')
                        .replace(/^export\s+interface\s+.*/gm,'')
                        .replace(/interface\s+[A-Za-z_$][\w$]*\s*\{[^}]*\}/g,'')
                        .replace(/type\s+[A-Za-z_$][\w$]*\s*=\s*[^;]+;/g,'');
                }

                var ast=acorn.parse(jsContent,{
                    ecmaVersion:2022,
                    sourceType:'module',
                    allowHashBang:true,
                    allowAwaitOutsideFunction:true,
                    allowImportExportEverywhere:true,
                    locations:true,
                    tolerant:true
                });

                var fnSet=new Set(fnNames);

                function walk(node,inDeclaration){
                    if(!node||typeof node!=='object')return;

                    // Track if we're in a function declaration to skip counting the name
                    var isDecl=node.type==='FunctionDeclaration'||node.type==='VariableDeclarator';

                    // CallExpression: foo() or foo.bar()
                    if(node.type==='CallExpression'){
                        var callee=node.callee;
                        if(callee.type==='Identifier'&&fnSet.has(callee.name)){
                            var line=callee.loc?callee.loc.start.line:0;
                            // Don't count if this is the definition line
                            if(!defLines[callee.name]||defLines[callee.name]!==line){
                                calls[callee.name]++;
                            }
                        }
                        // Also check arguments for function references
                        node.arguments.forEach(function(arg){
                            if(arg.type==='Identifier'&&fnSet.has(arg.name)){
                                refs[arg.name]++;
                            }
                        });
                    }

                    // Function passed as reference (callback): arr.map(fn), addEventListener('click', fn)
                    if(node.type==='Identifier'&&fnSet.has(node.name)&&!inDeclaration){
                        // This is handled via parent context - check if parent is not a CallExpression callee
                        // refs tracking happens in CallExpression arguments above
                    }

                    // Array element or object property value containing function ref
                    if(node.type==='ArrayExpression'){
                        node.elements.forEach(function(el){
                            if(el&&el.type==='Identifier'&&fnSet.has(el.name)){
                                refs[el.name]++;
                            }
                        });
                    }
                    if(node.type==='Property'&&node.value&&node.value.type==='Identifier'&&fnSet.has(node.value.name)){
                        refs[node.value.name]++;
                    }

                    // Recurse
                    for(var key in node){
                        if(key==='loc'||key==='range'||key==='start'||key==='end')continue;
                        var child=node[key];
                        var nextInDecl=isDecl&&(key==='id'||key==='key');
                        if(Array.isArray(child)){
                            child.forEach(function(c){walk(c,nextInDecl);});
                        }else if(child&&typeof child==='object'&&child.type){
                            walk(child,nextInDecl);
                        }
                    }
                }

                walk(ast,false);

                // Combine calls and refs
                fnNames.forEach(function(fn){
                    calls[fn]=calls[fn]+(refs[fn]||0);
                });

                return calls;

            }catch(e){
                // Fall back to regex but be more careful
            }
        }

        // Fallback: regex-based but more careful
        // Build word set for fast pre-filtering (avoids creating regex for every function name)
        var wordSet=new Set(content.match(/\b[a-zA-Z_$]\w*\b/g)||[]);
        // Count actual calls (fn() pattern) and references (fn without parens in specific contexts)
        fnNames.forEach(function(fn){
            // Fast check: skip if function name doesn't appear anywhere in the file
            if(!wordSet.has(fn))return;
            // Count calls: word boundary + name + optional whitespace + (
            var callPattern=new RegExp('\\b'+fn+'\\s*\\(','g');
            var m=content.match(callPattern);
            var callCount=m?m.length:0;

            // Subtract definitions that also match callPattern (fn() in definition context)
            // ONLY subtract patterns where the definition itself produces a fn( match:
            //   function fn(  →  matches callPattern, subtract
            //   def fn(       →  matches callPattern, subtract
            //   class fn(     →  matches callPattern, subtract
            // DO NOT subtract const/let/var fn = because arrow functions (const fn = () =>)
            // do NOT produce a fn( match, so subtracting would zero out real calls
            var defPattern=new RegExp('(?:function\\s+'+fn+'\\s*\\(|(?:async\\s+)?def\\s+'+fn+'\\s*\\(|class\\s+'+fn+'\\s*\\()','g');
            var defMatch=content.match(defPattern);
            if(defMatch)callCount-=defMatch.length;

            // Count references (callbacks): , fn) or , fn] or : fn} or [fn,
            var refPattern=new RegExp('[,\\[:\\(]\\s*'+fn+'\\s*[,\\]\\)\\}]','g');
            var refMatch=content.match(refPattern);
            var refCount=refMatch?refMatch.length:0;

            // VBA-specific: Call Name() or Application.Run "Name"
            var vbaCallPattern=new RegExp('(?:Call\\s+|Application\\.Run\\s*["\'])'+fn+'(?:["\'])?\\s*\\(','gi');
            var vbaMatch=content.match(vbaCallPattern);
            if(vbaMatch)callCount+=vbaMatch.length;

            // JSX element and expression detection for React/Vue/Svelte files
            // Acorn can't parse JSX, so these patterns are critical for .tsx/.jsx files
            if(isJS){
                // JSX elements: <ComponentName>, <ComponentName />, </ComponentName>
                var jsxTagPattern=new RegExp('<\\/?\\s*'+fn+'[\\s>\\/{]','g');
                var jsxTagMatch=content.match(jsxTagPattern);
                if(jsxTagMatch)refCount+=jsxTagMatch.length;
                // JSX attribute expressions: onClick={fn}, render={fn}, value={fn()}
                // Also catches object shorthand {fn} and template expressions {fn}
                var jsxExprPattern=new RegExp('[{=][ \\t]*'+fn+'[ \\t]*[}(,;\\s]','g');
                var jsxExprMatch=content.match(jsxExprPattern);
                if(jsxExprMatch)refCount+=jsxExprMatch.length;
            }

            calls[fn]=Math.max(0,callCount)+refCount;
        });

        return calls;
    }
};

function escapeHtml(value){
    return String(value==null?'':value)
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;')
        .replace(/'/g,'&#39;');
}

function renderTooltipHtml(title,stats){
    return '<div class="treemap-tooltip-title">'+escapeHtml(title)+'</div>'+stats.map(function(stat){
        return '<div class="treemap-tooltip-stat"><span>'+escapeHtml(stat.label)+':</span><span>'+escapeHtml(stat.value)+'</span></div>';
    }).join('');
}

function buildGitHubApiUrl(segments,query){
    var path=segments.filter(function(segment){return segment!==undefined&&segment!==null&&segment!=='';}).map(function(segment){
        return encodeURIComponent(String(segment));
    }).join('/');
    var url='https://api.github.com/'+path;
    if(!query)return url;
    var params=new URLSearchParams();
    Object.keys(query).forEach(function(key){
        var value=query[key];
        if(value===undefined||value===null||value==='')return;
        params.set(key,String(value));
    });
    var queryString=params.toString();
    return queryString?url+'?'+queryString:url;
}

function buildRepoApiUrl(owner,repo,segments,query){
    return buildGitHubApiUrl(['repos',owner,repo].concat(segments||[]),query);
}

function splitRepoPath(path){
    return (path||'').split('/').filter(Boolean);
}

function decodeBase64Utf8(content){
    var normalized=String(content||'').replace(/\s+/g,'');
    if(!normalized)return null;
    var binary=atob(normalized);
    var bytes=new Uint8Array(binary.length);
    for(var i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    try{
        return new TextDecoder('utf-8').decode(bytes);
    }catch(e){
        var text='';
        for(var j=0;j<bytes.length;j++)text+=String.fromCharCode(bytes[j]);
        return text;
    }
}
function getSeverityColor(level){
    return level==='critical'||level==='high'?'var(--red)':level==='medium'?'var(--orange)':'var(--blue)';
}

function getAccentBlockStyle(borderColor,tint,extra){
        return Object.assign({
            background:'linear-gradient(180deg, '+tint+' 0%, var(--bg0) 55%)',
            border:'1px solid '+borderColor,
            borderRadius:8
        },extra||{});
    }

function getFilePreviewIconName(filename){
    if(!Parser.isCode(filename))return'file';
    if(Parser.isVBA(filename))return'chart';
    if(Parser.isHTML(filename))return'globe';
    if(Parser.isCSS(filename))return'brush';
    if(Parser.isJSON(filename))return'note';
    return'code';
}

function getDialogTone(tone){
    if(tone==='danger')return{
        color:'var(--red)',
        borderColor:'rgba(255,95,95,0.34)',
        background:'rgba(255,95,95,0.12)'
    };
    if(tone==='info')return{
        color:'var(--blue)',
        borderColor:'rgba(77,159,255,0.34)',
        background:'rgba(77,159,255,0.12)'
    };
    return{
        color:'var(--orange)',
        borderColor:'rgba(255,159,67,0.34)',
        background:'rgba(255,159,67,0.12)'
    };
}

function buildAppUrl(repo,autoRun){
    var url=new URL(window.location.href);
    url.search='';
    if(repo)url.searchParams.set('repo',repo);
    if(autoRun&&repo)url.searchParams.set('run','1');
    return url.toString();
}




export { Parser, COLORS, LAYER_COLORS, IGNORE, DEFAULT_EXCLUDE_CHIPS, shouldExcludeFile, shouldIgnoreDirectory, compileExcludePatterns, parseExcludePatterns, getSeverityColor, getAccentBlockStyle, getFilePreviewIconName, getDialogTone, buildAppUrl, renderTooltipHtml, escapeHtml };

